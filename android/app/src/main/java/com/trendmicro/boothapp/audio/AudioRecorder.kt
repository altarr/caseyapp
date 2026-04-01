package com.trendmicro.boothapp.audio

import android.content.Context
import android.media.MediaRecorder
import android.os.Build
import android.util.Log
import java.io.File

/**
 * Records audio from the phone's microphone using MediaRecorder.
 * Saves as M4A (AAC) which Claude can transcribe directly.
 */
class AudioRecorder(private val context: Context) {

    private var recorder: MediaRecorder? = null
    private var outputFile: File? = null
    var isRecording: Boolean = false
        private set

    fun start(sessionId: String): File? {
        val dir = File(context.cacheDir, "recordings")
        dir.mkdirs()
        val file = File(dir, "${sessionId}.m4a")
        outputFile = file

        try {
            recorder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                MediaRecorder(context)
            } else {
                @Suppress("DEPRECATION")
                MediaRecorder()
            }

            recorder?.apply {
                setAudioSource(MediaRecorder.AudioSource.MIC)
                setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
                setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
                setAudioSamplingRate(44100)
                setAudioChannels(1)
                setAudioEncodingBitRate(128000)
                setOutputFile(file.absolutePath)
                prepare()
                start()
            }

            isRecording = true
            Log.d(TAG, "Recording started: ${file.absolutePath}")
            return file
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start recording", e)
            cleanup()
            return null
        }
    }

    fun stop(): File? {
        if (!isRecording) return outputFile

        try {
            recorder?.apply {
                stop()
                release()
            }
            Log.d(TAG, "Recording stopped: ${outputFile?.absolutePath} (${outputFile?.length()?.div(1024)} KB)")
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping recording", e)
        }

        cleanup()
        return outputFile
    }

    private fun cleanup() {
        recorder = null
        isRecording = false
    }

    companion object {
        private const val TAG = "AudioRecorder"
    }
}
