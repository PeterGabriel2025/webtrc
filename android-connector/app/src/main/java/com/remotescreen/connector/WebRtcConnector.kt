package com.remotescreen.connector

import android.content.Context
import android.content.Intent
import android.media.projection.MediaProjection
import io.socket.client.IO
import io.socket.client.Socket
import org.json.JSONObject
import org.webrtc.AudioSource
import org.webrtc.AudioTrack
import org.webrtc.DefaultVideoDecoderFactory
import org.webrtc.DefaultVideoEncoderFactory
import org.webrtc.EglBase
import org.webrtc.IceCandidate
import org.webrtc.MediaConstraints
import org.webrtc.MediaStream
import org.webrtc.PeerConnection
import org.webrtc.PeerConnectionFactory
import org.webrtc.ScreenCapturerAndroid
import org.webrtc.SessionDescription
import org.webrtc.SurfaceTextureHelper
import org.webrtc.VideoSource
import org.webrtc.VideoTrack

class WebRtcConnector(
    private val context: Context,
    private val signalingUrl: String,
    private val roomCode: String,
    private val onStatus: (String) -> Unit
) {
    private val socket: Socket = IO.socket(signalingUrl)
    private val eglBase = EglBase.create()
    private val factory: PeerConnectionFactory
    private var peerConnection: PeerConnection? = null
    private var screenCapturer: ScreenCapturerAndroid? = null
    private var screenSource: VideoSource? = null
    private var microphoneSource: AudioSource? = null
    private var screenTrack: VideoTrack? = null
    private var microphoneTrack: AudioTrack? = null

    init {
        PeerConnectionFactory.initialize(
            PeerConnectionFactory.InitializationOptions.builder(context).createInitializationOptions()
        )
        val encoderFactory = DefaultVideoEncoderFactory(eglBase.eglBaseContext, true, true)
        val decoderFactory = DefaultVideoDecoderFactory(eglBase.eglBaseContext)
        factory = PeerConnectionFactory.builder()
            .setVideoEncoderFactory(encoderFactory)
            .setVideoDecoderFactory(decoderFactory)
            .createPeerConnectionFactory()

        socket.on(Socket.EVENT_CONNECT) {
            socket.emit("join-room", JSONObject().put("roomCode", roomCode))
            onStatus("Joined room. Ready to share.")
        }
        socket.on("signal") { args ->
            val message = args.firstOrNull() as? JSONObject ?: return@on
            handleSignal(message)
        }
        socket.on("error-message") { args ->
            val message = args.firstOrNull() as? JSONObject
            onStatus(message?.optString("message") ?: "Signaling error.")
        }
    }

    fun connect() {
        socket.connect()
    }

    fun startSharing(projectionData: Intent) {
        val rtcConfig = PeerConnection.RTCConfiguration(
            listOf(PeerConnection.IceServer.builder("stun:stun.l.google.com:19302").createIceServer())
        )
        peerConnection = factory.createPeerConnection(rtcConfig, observer())
        val connection = peerConnection ?: return

        screenSource = factory.createVideoSource(false)
        screenCapturer = ScreenCapturerAndroid(projectionData, object : MediaProjection.Callback() {
            override fun onStop() {
                onStatus("Android stopped screen capture.")
            }
        })
        val helper = SurfaceTextureHelper.create("ScreenCapture", eglBase.eglBaseContext)
        screenCapturer?.initialize(helper, context, screenSource?.capturerObserver)
        screenCapturer?.startCapture(1280, 720, 30)
        screenTrack = factory.createVideoTrack("screen", screenSource)

        microphoneSource = factory.createAudioSource(MediaConstraints())
        microphoneTrack = factory.createAudioTrack("microphone", microphoneSource)
        connection.addTrack(screenTrack, listOf("remote-screen"))
        connection.addTrack(microphoneTrack, listOf("remote-screen"))

        connection.createOffer(object : SimpleSdpObserver() {
            override fun onCreateSuccess(description: SessionDescription) {
                connection.setLocalDescription(SimpleSdpObserver(), description)
                sendSignal("offer", JSONObject().put("type", description.type.canonicalForm())
                    .put("sdp", description.description))
            }
        }, MediaConstraints())
    }

    fun stopSharing() {
        try {
            screenCapturer?.stopCapture()
        } catch (_: InterruptedException) {
            Thread.currentThread().interrupt()
        }
        screenCapturer?.dispose()
        screenSource?.dispose()
        microphoneSource?.dispose()
        screenTrack?.dispose()
        microphoneTrack?.dispose()
        peerConnection?.close()
        peerConnection = null
        sendSignal("stop", JSONObject())
    }

    fun close() {
        stopSharing()
        socket.disconnect()
        factory.dispose()
        eglBase.release()
    }

    private fun handleSignal(message: JSONObject) {
        when (message.optString("type")) {
            "answer" -> {
                val data = message.optJSONObject("data") ?: return
                peerConnection?.setRemoteDescription(
                    SimpleSdpObserver(),
                    SessionDescription(
                        SessionDescription.Type.fromCanonicalForm(data.optString("type")),
                        data.optString("sdp")
                    )
                )
            }
            "ice-candidate" -> {
                val data = message.optJSONObject("data") ?: return
                peerConnection?.addIceCandidate(
                    IceCandidate(
                        data.optString("sdpMid"),
                        data.optInt("sdpMLineIndex"),
                        data.optString("candidate")
                    )
                )
            }
        }
    }

    private fun sendSignal(type: String, data: JSONObject) {
        socket.emit(
            "signal",
            JSONObject().put("roomCode", roomCode).put("type", type).put("data", data)
        )
    }

    private fun observer() = object : PeerConnection.Observer by EmptyPeerConnectionObserver() {
        override fun onIceCandidate(candidate: org.webrtc.IceCandidate) {
            sendSignal(
                "ice-candidate",
                JSONObject()
                    .put("sdpMid", candidate.sdpMid)
                    .put("sdpMLineIndex", candidate.sdpMLineIndex)
                    .put("candidate", candidate.sdp)
            )
        }

        private class EmptyPeerConnectionObserver : PeerConnection.Observer {
            override fun onSignalingChange(state: PeerConnection.SignalingState) = Unit
            override fun onIceConnectionChange(state: PeerConnection.IceConnectionState) = Unit
            override fun onIceConnectionReceivingChange(receiving: Boolean) = Unit
            override fun onIceGatheringChange(state: PeerConnection.IceGatheringState) = Unit
            override fun onIceCandidate(candidate: IceCandidate) = Unit
            override fun onIceCandidatesRemoved(candidates: Array<IceCandidate>) = Unit
            override fun onAddStream(stream: MediaStream) = Unit
            override fun onRemoveStream(stream: MediaStream) = Unit
            override fun onDataChannel(channel: org.webrtc.DataChannel) = Unit
            override fun onRenegotiationNeeded() = Unit
            override fun onAddTrack(
                receiver: org.webrtc.RtpReceiver,
                mediaStreams: Array<MediaStream>
            ) = Unit
            override fun onTrack(transceiver: org.webrtc.RtpTransceiver) = Unit
        }
    }
}

open class SimpleSdpObserver : org.webrtc.SdpObserver {
    override fun onCreateSuccess(description: SessionDescription) {}
    override fun onSetSuccess() {}
    override fun onCreateFailure(error: String) {}
    override fun onSetFailure(error: String) {}
}
