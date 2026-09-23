package com.remotescreen.connector

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.media.projection.MediaProjectionManager
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat

class MainActivity : AppCompatActivity() {
    private lateinit var roomCodeInput: EditText
    private lateinit var statusText: TextView
    private lateinit var startButton: Button
    private lateinit var stopButton: Button
    private var roomCode: String? = null
    private var sharing = false
    private var projectionData: Intent? = null
    private var client: WebRtcConnector? = null

    private val projectionLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            if (result.resultCode != Activity.RESULT_OK || result.data == null) {
                statusText.text = "Screen sharing permission was cancelled."
                startButton.isEnabled = true
                return@registerForActivityResult
            }
            projectionData = result.data
            requestMicrophone()
        }

    private val microphoneLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            if (granted) {
                startSharing()
            } else {
                statusText.text = "Microphone permission is required to share audio."
                startButton.isEnabled = true
            }
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        roomCodeInput = findViewById(R.id.room_code)
        statusText = findViewById(R.id.status)
        startButton = findViewById(R.id.start_sharing)
        stopButton = findViewById(R.id.stop_sharing)

        findViewById<Button>(R.id.join_room).setOnClickListener { joinRoom() }
        startButton.setOnClickListener { requestScreenCapture() }
        stopButton.setOnClickListener { stopSharing() }
    }

    private fun joinRoom() {
        val code = roomCodeInput.text.toString().trim().uppercase()
        if (!code.matches(Regex("[A-Z0-9]{6}"))) {
            statusText.text = "Enter a valid six-character room code."
            return
        }

        roomCode = code
        client = WebRtcConnector(
            context = this,
            signalingUrl = getString(R.string.signaling_url),
            roomCode = code,
            onStatus = { message -> runOnUiThread { statusText.text = message } }
        )
        client?.connect()
        roomCodeInput.isEnabled = false
        findViewById<Button>(R.id.join_room).isEnabled = false
        startButton.isEnabled = true
    }

    private fun requestScreenCapture() {
        startButton.isEnabled = false
        val manager = getSystemService(MediaProjectionManager::class.java)
        projectionLauncher.launch(manager.createScreenCaptureIntent())
    }

    private fun requestMicrophone() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
            == PackageManager.PERMISSION_GRANTED
        ) {
            startSharing()
        } else {
            microphoneLauncher.launch(Manifest.permission.RECORD_AUDIO)
        }
    }

    private fun startSharing() {
        val data = projectionData ?: return
        ContextCompat.startForegroundService(
            this,
            Intent(this, CaptureForegroundService::class.java)
        )
        client?.startSharing(data)
        sharing = true
        stopButton.isEnabled = true
        statusText.text = "Sharing screen and microphone."
    }

    private fun stopSharing() {
        client?.stopSharing()
        stopService(Intent(this, CaptureForegroundService::class.java))
        sharing = false
        stopButton.isEnabled = false
        startButton.isEnabled = true
        statusText.text = "Sharing stopped."
    }

    override fun onDestroy() {
        if (sharing) {
            stopSharing()
        }
        client?.close()
        super.onDestroy()
    }
}
