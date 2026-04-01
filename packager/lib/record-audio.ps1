# Phantom Recall — PowerShell Audio Recorder
# Records from default microphone using Windows WaveIn API (no ffmpeg needed)
# Usage: powershell -File record-audio.ps1 -OutputFile recording.wav
# Stop: create a file called "stop" in the same directory, or Ctrl+C

param(
    [string]$OutputFile = "recording.wav",
    [string]$StopFile = ""
)

Add-Type -AssemblyName System.Runtime.InteropServices

# WaveIn P/Invoke
Add-Type -TypeDefinition @"
using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;

public class SimpleRecorder {
    const int WAVE_MAPPER = -1;
    const int CALLBACK_FUNCTION = 0x30000;
    const int MM_WIM_DATA = 0x3C4;
    const int WHDR_DONE = 0x1;

    [StructLayout(LayoutKind.Sequential)]
    struct WAVEFORMATEX {
        public ushort wFormatTag;
        public ushort nChannels;
        public uint nSamplesPerSec;
        public uint nAvgBytesPerSec;
        public ushort nBlockAlign;
        public ushort wBitsPerSample;
        public ushort cbSize;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct WAVEHDR {
        public IntPtr lpData;
        public uint dwBufferLength;
        public uint dwBytesRecorded;
        public IntPtr dwUser;
        public uint dwFlags;
        public uint dwLoops;
        public IntPtr lpNext;
        public IntPtr reserved;
    }

    [DllImport("winmm.dll")] static extern int waveInOpen(out IntPtr handle, int deviceId, ref WAVEFORMATEX format, WaveInProc callback, IntPtr instance, int flags);
    [DllImport("winmm.dll")] static extern int waveInPrepareHeader(IntPtr handle, ref WAVEHDR header, int size);
    [DllImport("winmm.dll")] static extern int waveInUnprepareHeader(IntPtr handle, ref WAVEHDR header, int size);
    [DllImport("winmm.dll")] static extern int waveInAddBuffer(IntPtr handle, ref WAVEHDR header, int size);
    [DllImport("winmm.dll")] static extern int waveInStart(IntPtr handle);
    [DllImport("winmm.dll")] static extern int waveInStop(IntPtr handle);
    [DllImport("winmm.dll")] static extern int waveInReset(IntPtr handle);
    [DllImport("winmm.dll")] static extern int waveInClose(IntPtr handle);

    delegate void WaveInProc(IntPtr handle, int msg, IntPtr instance, IntPtr param1, IntPtr param2);

    static MemoryStream audioData;
    static IntPtr hWaveIn;
    static WAVEHDR[] headers;
    static IntPtr[] bufferPtrs;
    static bool recording;
    static int bufferSize = 8820; // ~100ms at 44100Hz mono 16bit

    static void Callback(IntPtr handle, int msg, IntPtr instance, IntPtr param1, IntPtr param2) {
        if (msg == MM_WIM_DATA && recording) {
            WAVEHDR hdr = Marshal.PtrToStructure<WAVEHDR>(param1);
            if (hdr.dwBytesRecorded > 0) {
                byte[] data = new byte[hdr.dwBytesRecorded];
                Marshal.Copy(hdr.lpData, data, 0, (int)hdr.dwBytesRecorded);
                lock (audioData) { audioData.Write(data, 0, data.Length); }
            }
            if (recording) {
                waveInAddBuffer(handle, ref hdr, Marshal.SizeOf<WAVEHDR>());
                Marshal.StructureToPtr(hdr, param1, false);
            }
        }
    }

    public static bool Record(string outputFile, string stopFile) {
        audioData = new MemoryStream();
        recording = true;

        WAVEFORMATEX fmt = new WAVEFORMATEX();
        fmt.wFormatTag = 1; // PCM
        fmt.nChannels = 1;
        fmt.nSamplesPerSec = 44100;
        fmt.wBitsPerSample = 16;
        fmt.nBlockAlign = (ushort)(fmt.nChannels * fmt.wBitsPerSample / 8);
        fmt.nAvgBytesPerSec = fmt.nSamplesPerSec * fmt.nBlockAlign;

        WaveInProc callback = new WaveInProc(Callback);
        int result = waveInOpen(out hWaveIn, WAVE_MAPPER, ref fmt, callback, IntPtr.Zero, CALLBACK_FUNCTION);
        if (result != 0) { Console.Error.WriteLine("waveInOpen failed: " + result); return false; }

        // Allocate buffers
        int numBuffers = 4;
        headers = new WAVEHDR[numBuffers];
        bufferPtrs = new IntPtr[numBuffers];
        for (int i = 0; i < numBuffers; i++) {
            bufferPtrs[i] = Marshal.AllocHGlobal(bufferSize);
            headers[i].lpData = bufferPtrs[i];
            headers[i].dwBufferLength = (uint)bufferSize;
            waveInPrepareHeader(hWaveIn, ref headers[i], Marshal.SizeOf<WAVEHDR>());
            waveInAddBuffer(hWaveIn, ref headers[i], Marshal.SizeOf<WAVEHDR>());
        }

        waveInStart(hWaveIn);
        Console.WriteLine("RECORDING");

        // Wait for stop signal
        while (recording) {
            Thread.Sleep(500);
            if (!string.IsNullOrEmpty(stopFile) && File.Exists(stopFile)) {
                recording = false;
                try { File.Delete(stopFile); } catch {}
            }
        }

        waveInStop(hWaveIn);
        waveInReset(hWaveIn);

        for (int i = 0; i < headers.Length; i++) {
            waveInUnprepareHeader(hWaveIn, ref headers[i], Marshal.SizeOf<WAVEHDR>());
            Marshal.FreeHGlobal(bufferPtrs[i]);
        }
        waveInClose(hWaveIn);

        // Write WAV file
        byte[] pcm = audioData.ToArray();
        using (var fs = new FileStream(outputFile, FileMode.Create)) {
            var bw = new BinaryWriter(fs);
            bw.Write(new char[] {'R','I','F','F'});
            bw.Write(36 + pcm.Length);
            bw.Write(new char[] {'W','A','V','E'});
            bw.Write(new char[] {'f','m','t',' '});
            bw.Write(16); // chunk size
            bw.Write((short)1); // PCM
            bw.Write((short)fmt.nChannels);
            bw.Write((int)fmt.nSamplesPerSec);
            bw.Write((int)fmt.nAvgBytesPerSec);
            bw.Write((short)fmt.nBlockAlign);
            bw.Write((short)fmt.wBitsPerSample);
            bw.Write(new char[] {'d','a','t','a'});
            bw.Write(pcm.Length);
            bw.Write(pcm);
        }
        Console.WriteLine("SAVED " + outputFile + " (" + (pcm.Length / 1024) + " KB)");
        return true;
    }

    public static void Stop() { recording = false; }
}
"@

Write-Host "[recorder] Starting audio recording -> $OutputFile"
$stopPath = if ($StopFile) { $StopFile } else { Join-Path (Split-Path $OutputFile) "stop-recording" }

# Run recording (blocks until stop file appears)
$result = [SimpleRecorder]::Record($OutputFile, $stopPath)
if ($result) {
    Write-Host "[recorder] Recording saved: $OutputFile"
} else {
    Write-Host "[recorder] Recording failed" -ForegroundColor Red
    exit 1
}
