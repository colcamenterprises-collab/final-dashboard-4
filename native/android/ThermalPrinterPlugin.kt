package io.customli.sbbpos

import android.Manifest
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothSocket
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.util.Base64
import androidx.core.app.ActivityCompat
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.io.IOException
import java.util.UUID

@CapacitorPlugin(name = "ThermalPrinter")
class ThermalPrinterPlugin : Plugin() {
    private val sppUuid: UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")
    private var socket: BluetoothSocket? = null
    private var connectedDevice: BluetoothDevice? = null

    private fun adapter(): BluetoothAdapter? {
        val manager = context.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager
        return manager.adapter
    }

    private fun hasConnectPermission(): Boolean {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.S ||
            ActivityCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED
    }

    private fun requireBluetooth(call: PluginCall): BluetoothAdapter? {
        val adapter = adapter()
        if (adapter == null) {
            call.reject("Bluetooth is not supported on this tablet")
            return null
        }
        if (!adapter.isEnabled) {
            call.reject("Bluetooth is turned off")
            return null
        }
        if (!hasConnectPermission()) {
            call.reject("Bluetooth permission is required. Allow Nearby devices for Smash Brothers POS.")
            return null
        }
        return adapter
    }

    @PluginMethod
    fun listPrinters(call: PluginCall) {
        val adapter = requireBluetooth(call) ?: return
        try {
            val result = JSArray()
            adapter.bondedDevices.sortedBy { it.name ?: it.address }.forEach { device ->
                val item = JSObject()
                item.put("name", device.name ?: "Bluetooth printer")
                item.put("address", device.address)
                item.put("bonded", device.bondState == BluetoothDevice.BOND_BONDED)
                result.put(item)
            }
            val ret = JSObject()
            ret.put("printers", result)
            call.resolve(ret)
        } catch (error: Exception) {
            call.reject("Could not list paired Bluetooth devices", error)
        }
    }

    @PluginMethod
    fun connect(call: PluginCall) {
        val adapter = requireBluetooth(call) ?: return
        val address = call.getString("address")?.trim()
        if (address.isNullOrEmpty()) {
            call.reject("Printer address is required")
            return
        }

        Thread {
            try {
                disconnectInternal()
                val device = adapter.getRemoteDevice(address)
                adapter.cancelDiscovery()
                val newSocket = device.createRfcommSocketToServiceRecord(sppUuid)
                newSocket.connect()
                socket = newSocket
                connectedDevice = device
                val ret = JSObject()
                ret.put("connected", true)
                ret.put("name", device.name ?: "Bluetooth printer")
                ret.put("address", device.address)
                call.resolve(ret)
            } catch (error: Exception) {
                disconnectInternal()
                call.reject("Could not connect to Bluetooth printer: ${error.message ?: "connection failed"}", error)
            }
        }.start()
    }

    @PluginMethod
    fun disconnect(call: PluginCall) {
        disconnectInternal()
        val ret = JSObject()
        ret.put("connected", false)
        call.resolve(ret)
    }

    @PluginMethod
    fun getStatus(call: PluginCall) {
        val ret = JSObject()
        val active = socket?.isConnected == true
        ret.put("connected", active)
        if (active) {
            ret.put("name", connectedDevice?.name ?: "Bluetooth printer")
            ret.put("address", connectedDevice?.address ?: "")
        }
        call.resolve(ret)
    }

    @PluginMethod
    fun printRaw(call: PluginCall) {
        val encoded = call.getString("base64")
        if (encoded.isNullOrEmpty()) {
            call.reject("Print data is required")
            return
        }
        val bytes = try {
            Base64.decode(encoded, Base64.DEFAULT)
        } catch (error: Exception) {
            call.reject("Print data is invalid", error)
            return
        }
        write(call, bytes)
    }

    @PluginMethod
    fun printTest(call: PluginCall) {
        val esc = byteArrayOf(0x1B, 0x40)
        val center = byteArrayOf(0x1B, 0x61, 0x01)
        val left = byteArrayOf(0x1B, 0x61, 0x00)
        val body = "SMASH BROTHERS BURGERS\n58MM BLUETOOTH PRINTER TEST\n\n".toByteArray(Charsets.US_ASCII)
        val detail = "ESC/POS DIRECT CONNECTION\nNO ANDROID PRINT SERVICE\n\n\n".toByteArray(Charsets.US_ASCII)
        val bytes = esc + center + body + left + detail
        write(call, bytes)
    }

    @PluginMethod
    fun openCashDrawer(call: PluginCall) {
        // Standard ESC/POS drawer kick: ESC p m t1 t2
        write(call, byteArrayOf(0x1B, 0x70, 0x00, 0x32, 0xFA.toByte()))
    }

    private fun write(call: PluginCall, bytes: ByteArray) {
        Thread {
            try {
                val active = socket
                if (active == null || !active.isConnected) {
                    call.reject("Printer is not connected")
                    return@Thread
                }
                val output = active.outputStream
                output.write(bytes)
                output.flush()
                val ret = JSObject()
                ret.put("ok", true)
                call.resolve(ret)
            } catch (error: IOException) {
                disconnectInternal()
                call.reject("Printer connection was lost: ${error.message ?: "write failed"}", error)
            } catch (error: Exception) {
                call.reject("Printing failed: ${error.message ?: "unknown error"}", error)
            }
        }.start()
    }

    private fun disconnectInternal() {
        try { socket?.outputStream?.flush() } catch (_: Exception) { }
        try { socket?.close() } catch (_: Exception) { }
        socket = null
        connectedDevice = null
    }

    override fun handleOnDestroy() {
        disconnectInternal()
        super.handleOnDestroy()
    }
}
