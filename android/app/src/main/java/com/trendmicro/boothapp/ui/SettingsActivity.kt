package com.trendmicro.boothapp.ui

import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.trendmicro.boothapp.data.AppPreferences
import com.trendmicro.boothapp.databinding.ActivitySettingsBinding

/**
 * Settings screen for configuring orchestrator URL, default demo PC/SE name, and AWS credentials.
 */
class SettingsActivity : AppCompatActivity() {

    private lateinit var binding: ActivitySettingsBinding
    private lateinit var prefs: AppPreferences

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivitySettingsBinding.inflate(layoutInflater)
        setContentView(binding.root)

        prefs = AppPreferences(this)
        loadCurrentSettings()

        binding.btnSave.setOnClickListener { saveSettings() }
    }

    private fun loadCurrentSettings() {
        binding.etOrchestratorUrl.setText(prefs.orchestratorUrl)
        binding.etDefaultDemoPc.setText(prefs.defaultDemoPc)
        binding.etDefaultSeName.setText(prefs.defaultSeName)
        binding.etAwsAccessKey.setText(prefs.awsAccessKeyId)
        binding.etAwsSecretKey.setText(prefs.awsSecretAccessKey)
    }

    private fun saveSettings() {
        prefs.orchestratorUrl = binding.etOrchestratorUrl.text?.toString() ?: ""
        prefs.defaultDemoPc = binding.etDefaultDemoPc.text?.toString() ?: "booth-pc-1"
        prefs.defaultSeName = binding.etDefaultSeName.text?.toString() ?: ""
        prefs.awsAccessKeyId = binding.etAwsAccessKey.text?.toString() ?: ""
        prefs.awsSecretAccessKey = binding.etAwsSecretKey.text?.toString() ?: ""

        Toast.makeText(this, "Settings saved", Toast.LENGTH_SHORT).show()
        finish()
    }
}
