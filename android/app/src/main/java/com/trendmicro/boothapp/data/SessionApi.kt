package com.trendmicro.boothapp.data

import com.google.gson.Gson
import com.google.gson.annotations.SerializedName
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File
import java.util.concurrent.TimeUnit

/**
 * Client for session orchestrator (legacy) or management server (v2).
 * When using management server, all endpoints are prefixed with /api/.
 */
class SessionApi(private val baseUrl: String, private val useManagement: Boolean = false) {

    private val apiPrefix: String get() = if (useManagement) "/api" else ""

    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    private val gson = Gson()
    private val jsonType = "application/json; charset=utf-8".toMediaType()

    data class CreateSessionRequest(
        @SerializedName("visitor_name") val visitorName: String,
        @SerializedName("visitor_company") val visitorCompany: String?,
        @SerializedName("visitor_title") val visitorTitle: String? = null,
        @SerializedName("visitor_email") val visitorEmail: String? = null,
        @SerializedName("visitor_phone") val visitorPhone: String? = null,
        @SerializedName("badge_photo") val badgePhoto: String? = null,
        @SerializedName("demo_pc") val demoPc: String,
        @SerializedName("se_name") val seName: String?,
        @SerializedName("event_id") val eventId: Int? = null,
        @SerializedName("audio_consent") val audioConsent: Boolean = true
    )

    data class CreateSessionResponse(
        @SerializedName("session_id") val sessionId: String,
        val metadata: Map<String, Any?>?,
        @SerializedName("tenant_available") val tenantAvailable: Boolean?
    )

    data class EndSessionResponse(
        @SerializedName("session_id") val sessionId: String,
        val status: String,
        @SerializedName("ended_at") val endedAt: String?,
        val message: String?
    )

    suspend fun createSession(request: CreateSessionRequest): Result<CreateSessionResponse> =
        withContext(Dispatchers.IO) {
            try {
                val body = gson.toJson(request).toRequestBody(jsonType)
                val endpoint = if (useManagement) "$baseUrl$apiPrefix/sessions/create" else "$baseUrl/sessions"
                val httpRequest = Request.Builder()
                    .url(endpoint)
                    .post(body)
                    .build()

                val response = client.newCall(httpRequest).execute()
                val responseBody = response.body?.string() ?: ""

                if (response.isSuccessful) {
                    Result.success(gson.fromJson(responseBody, CreateSessionResponse::class.java))
                } else {
                    Result.failure(Exception("HTTP ${response.code}: $responseBody"))
                }
            } catch (e: Exception) {
                Result.failure(e)
            }
        }

    suspend fun endSession(sessionId: String, demoPc: String? = null): Result<EndSessionResponse> =
        withContext(Dispatchers.IO) {
            try {
                val bodyMap = mutableMapOf<String, Any>()
                if (demoPc != null) bodyMap["demo_pc"] = demoPc
                val body = gson.toJson(bodyMap).toRequestBody(jsonType)

                val httpRequest = Request.Builder()
                    .url("$baseUrl$apiPrefix/sessions/$sessionId/end")
                    .post(body)
                    .build()

                val response = client.newCall(httpRequest).execute()
                val responseBody = response.body?.string() ?: ""

                if (response.isSuccessful) {
                    Result.success(gson.fromJson(responseBody, EndSessionResponse::class.java))
                } else {
                    Result.failure(Exception("HTTP ${response.code}: $responseBody"))
                }
            } catch (e: Exception) {
                Result.failure(e)
            }
        }

    @Suppress("UNCHECKED_CAST")
    suspend fun stopAudio(sessionId: String, demoPc: String? = null): Result<Map<String, Any>> =
        withContext(Dispatchers.IO) {
            try {
                val bodyMap = mutableMapOf<String, Any>()
                if (demoPc != null) bodyMap["demo_pc"] = demoPc
                val body = gson.toJson(bodyMap).toRequestBody(jsonType)

                val httpRequest = Request.Builder()
                    .url("$baseUrl$apiPrefix/sessions/$sessionId/stop-audio")
                    .post(body)
                    .build()

                val response = client.newCall(httpRequest).execute()
                val responseBody = response.body?.string() ?: ""

                if (response.isSuccessful) {
                    val map = gson.fromJson(responseBody, Map::class.java) as Map<String, Any>
                    Result.success(map)
                } else {
                    Result.failure(Exception("HTTP ${response.code}: $responseBody"))
                }
            } catch (e: Exception) {
                Result.failure(e)
            }
        }

    suspend fun uploadAudio(sessionId: String, audioFile: File): Result<Boolean> =
        withContext(Dispatchers.IO) {
            try {
                val requestBody = MultipartBody.Builder()
                    .setType(MultipartBody.FORM)
                    .addFormDataPart("session_id", sessionId)
                    .addFormDataPart(
                        "audio", audioFile.name,
                        audioFile.asRequestBody("audio/mp4".toMediaType())
                    )
                    .build()

                val httpRequest = Request.Builder()
                    .url("$baseUrl$apiPrefix/sessions/$sessionId/audio")
                    .post(requestBody)
                    .build()

                val response = client.newCall(httpRequest).execute()
                Result.success(response.isSuccessful)
            } catch (e: Exception) {
                Result.failure(e)
            }
        }

    @Suppress("UNCHECKED_CAST")
    suspend fun scanBadge(imageFile: File, eventId: Int): Result<Map<String, String>> =
        withContext(Dispatchers.IO) {
            try {
                val requestBody = MultipartBody.Builder()
                    .setType(MultipartBody.FORM)
                    .addFormDataPart("event_id", eventId.toString())
                    .addFormDataPart(
                        "badge", imageFile.name,
                        imageFile.asRequestBody("image/jpeg".toMediaType())
                    )
                    .build()

                val httpRequest = Request.Builder()
                    .url("$baseUrl$apiPrefix/badges/scan")
                    .post(requestBody)
                    .build()

                val response = client.newCall(httpRequest).execute()
                val responseBody = response.body?.string() ?: ""

                if (response.isSuccessful) {
                    val parsed = gson.fromJson(responseBody, Map::class.java) as Map<String, Any>
                    val fields = (parsed["fields"] as? Map<String, Any>)
                        ?.mapValues { it.value?.toString() ?: "" }
                        ?: emptyMap()
                    Result.success(fields)
                } else {
                    Result.failure(Exception("HTTP ${response.code}: $responseBody"))
                }
            } catch (e: Exception) {
                Result.failure(e)
            }
        }
}
