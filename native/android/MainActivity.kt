package io.customli.sbbpos

import android.os.Bundle
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(ThermalPrinterPlugin::class.java)
        super.onCreate(savedInstanceState)
    }
}
