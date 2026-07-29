export type PosPrinterSettings = {
  printerName: string;
  paperWidth: 58 | 80;
  autoPrint: boolean;
};

export const POS_PRINTER_SETTINGS_KEY = "sbb_pos_printer_settings";

export const DEFAULT_POS_PRINTER_SETTINGS: PosPrinterSettings = {
  printerName: "Receipt printer",
  paperWidth: 58,
  autoPrint: true,
};

export function readPosPrinterSettings(): PosPrinterSettings {
  try {
    const stored = JSON.parse(
      window.localStorage.getItem(POS_PRINTER_SETTINGS_KEY) || "null",
    );
    return {
      printerName:
        typeof stored?.printerName === "string" && stored.printerName.trim()
          ? stored.printerName.trim()
          : DEFAULT_POS_PRINTER_SETTINGS.printerName,
      paperWidth: stored?.paperWidth === 80 ? 80 : 58,
      autoPrint: stored?.autoPrint !== false,
    };
  } catch {
    return DEFAULT_POS_PRINTER_SETTINGS;
  }
}

export function savePosPrinterSettings(settings: PosPrinterSettings) {
  window.localStorage.setItem(
    POS_PRINTER_SETTINGS_KEY,
    JSON.stringify(settings),
  );
}
