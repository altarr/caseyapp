package com.trendmicro.boothapp.data

import com.google.gson.Gson
import com.google.gson.annotations.SerializedName
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

/**
 * Client for the session orchestrator Lambda.
 * POST /sessions      -> create session
 * POST /sessions/:id/end -> end session
 */
class SessionApi(private val baseUrl: String) {

    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    private val gson = Gson()
    private val jsonType = "application/json; charset=utf-8".toMediaType()

    data class CreateSessionRequest(
        @SerializedName("visitor_name") val visitorName: String,
        @SerializedName("badge_photo") val badgePhoto: String?,
        @SerializedName("demo_pc") val demoPc: String,
        @SerializedName("se_name") val seName: String?,
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
                val httpRequest = Request.Builder()
                    .url("$baseUrl/sessions")
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
                    .url("$baseUrl/sessions/$sessionId/end")
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
}
