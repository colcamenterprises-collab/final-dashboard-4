package io.customli.sbbpos;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

import java.util.ArrayList;
import java.util.List;

public class MainActivity extends BridgeActivity {
  private static final int BLUETOOTH_PERMISSION_REQUEST = 1001;

  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(ThermalPrinterPlugin.class);
    super.onCreate(savedInstanceState);
    requestBluetoothPermissionsIfNeeded();
  }

  private void requestBluetoothPermissionsIfNeeded() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return;

    List<String> missing = new ArrayList<>();
    if (checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) {
      missing.add(Manifest.permission.BLUETOOTH_CONNECT);
    }
    if (checkSelfPermission(Manifest.permission.BLUETOOTH_SCAN) != PackageManager.PERMISSION_GRANTED) {
      missing.add(Manifest.permission.BLUETOOTH_SCAN);
    }

    if (!missing.isEmpty()) {
      requestPermissions(missing.toArray(new String[0]), BLUETOOTH_PERMISSION_REQUEST);
    }
  }
}
