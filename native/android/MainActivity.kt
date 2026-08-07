package io.customli.sbbpos

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(ThermalPrinterPlugin::class.java)
        super.onCreate(savedInstanceState)

        // Android 12+ splits classic Bluetooth access into the Nearby Devices
        // runtime permission group. The printer bridge needs both permissions:
        // CONNECT for bonded-device details/RFCOMM and SCAN for cancelling any
        // discovery before opening the socket. Request the complete set here so
        // the first visit to Printer Settings is immediately usable.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val missing = mutableListOf<String>()
            if (checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) {
                missing.add(Manifest.permission.BLUETOOTH_CONNECT)
            }
            if (checkSelfPermission(Manifest.permission.BLUETOOTH_SCAN) != PackageManager.PERMISSION_GRANTED) {
                missing.add(Manifest.permission.BLUETOOTH_SCAN)
            }
            if (missing.isNotEmpty()) {
                requestPermissions(missing.toTypedArray(), 1001)
            }
        }
    }
}
