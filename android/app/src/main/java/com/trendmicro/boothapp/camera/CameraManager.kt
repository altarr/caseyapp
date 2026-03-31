package com.trendmicro.boothapp.camera

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.util.Log
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import java.io.File
import java.io.FileOutputStream
import java.nio.ByteBuffer

/**
 * Manages CameraX lifecycle: preview binding and image capture.
 * Captures badge photos as JPEG files for OCR and S3 upload.
 */
class CameraManager(private val context: Context) {

    private var imageCapture: ImageCapture? = null
    private var cameraProvider: ProcessCameraProvider? = null

    interface CaptureCallback {
        fun onCaptured(bitmap: Bitmap, file: File)
        fun onError(message: String)
    }

    fun startCamera(previewView: PreviewView, lifecycleOwner: LifecycleOwner) {
        val cameraProviderFuture = ProcessCameraProvider.getInstance(context)

        cameraProviderFuture.addListener({
            val provider = cameraProviderFuture.get()
            cameraProvider = provider

            val preview = Preview.Builder()
                .build()
                .also { it.setSurfaceProvider(previewView.surfaceProvider) }

            imageCapture = ImageCapture.Builder()
                .setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY)
                .setJpegQuality(80)
                .build()

            val cameraSelector = CameraSelector.DEFAULT_BACK_CAMERA

            try {
                provider.unbindAll()
                provider.bindToLifecycle(lifecycleOwner, cameraSelector, preview, imageCapture)
                Log.d(TAG, "Camera bound successfully")
            } catch (e: Exception) {
                Log.e(TAG, "Camera bind failed", e)
            }
        }, ContextCompat.getMainExecutor(context))
    }

    fun capturePhoto(callback: CaptureCallback) {
        val capture = imageCapture ?: run {
            callback.onError("Camera not initialized")
            return
        }

        capture.takePicture(
            ContextCompat.getMainExecutor(context),
            object : ImageCapture.OnImageCapturedCallback() {
                override fun onCaptureSuccess(imageProxy: ImageProxy) {
                    try {
                        val bitmap = imageProxyToBitmap(imageProxy)
                        val file = saveBitmapToFile(bitmap)
                        callback.onCaptured(bitmap, file)
                    } catch (e: Exception) {
                        callback.onError("Failed to process capture: ${e.message}")
                    } finally {
                        imageProxy.close()
                    }
                }

                override fun onError(exception: ImageCaptureException) {
                    callback.onError("Capture failed: ${exception.message}")
                }
            }
        )
    }

    private fun imageProxyToBitmap(imageProxy: ImageProxy): Bitmap {
        val buffer: ByteBuffer = imageProxy.planes[0].buffer
        val bytes = ByteArray(buffer.remaining())
        buffer.get(bytes)
        val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)

        // Apply rotation from EXIF
        val rotation = imageProxy.imageInfo.rotationDegrees
        return if (rotation != 0) {
            val matrix = Matrix().apply { postRotate(rotation.toFloat()) }
            Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
        } else {
            bitmap
        }
    }

    private fun saveBitmapToFile(bitmap: Bitmap): File {
        val file = File(context.cacheDir, "badge_${System.currentTimeMillis()}.jpg")
        FileOutputStream(file).use { out ->
            bitmap.compress(Bitmap.CompressFormat.JPEG, 80, out)
        }
        return file
    }

    fun shutdown() {
        cameraProvider?.unbindAll()
    }

    companion object {
        private const val TAG = "CameraManager"
    }
}
