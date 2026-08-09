import fs from "node:fs";

const path = "client/src/pages/pos/PosRegister.tsx";
let source = fs.readFileSync(path, "utf8");

const importFind = 'import { useEffect, useMemo, useState } from "react";';
const importReplace = 'import { useEffect, useMemo, useState } from "react";\nimport { readPosPrinterSettings } from "@/lib/posPrinterSettings";\nimport { nativePrinterAvailable, nativeSpeak, printReceiptNative } from "@/lib/thermalPrinter";';
if (!source.includes('nativeSpeak, printReceiptNative')) {
  if (!source.includes(importFind)) throw new Error("PosRegister import marker not found");
  source = source.replace(importFind, importReplace);
}

const blockFind = `      setMarketingOpen(false);\n      setNotice(\`${'${body.data.ticket_number}'} sent to kitchen\`);\n      speakKitchenOrder(kitchenCalloutItems(),language);`;
const blockReplace = `      setMarketingOpen(false);\n\n      const calloutItems = kitchenCalloutItems();\n      const calloutText = \`${'${language === "th" ? "ออเดอร์ใหม่:" : "New order:"}'} ${'${calloutItems.join(", ")}'}\`;\n      if (nativePrinterAvailable()) {\n        void nativeSpeak(calloutText, language === "th" ? "th-TH" : "en-US")\n          .catch(() => speakKitchenOrder(calloutItems, language));\n      } else {\n        speakKitchenOrder(calloutItems, language);\n      }\n\n      const printerSettings = readPosPrinterSettings();\n      let printFailure = "";\n      if (printerSettings.autoPrint) {\n        const printResult = await printReceiptNative({\n          ticketNumber: body.data.ticket_number,\n          paymentMethod: mode === "grab" ? "grab" : payment,\n          subtotal,\n          discount: discountPreview,\n          total,\n          cashReceived: mode === "direct" && payment === "cash" ? Number(cash || 0) : undefined,\n          change: mode === "direct" && payment === "cash" ? change : undefined,\n          lines: cart.map(line => ({\n            name: line.name_en,\n            quantity: line.quantity,\n            unitPrice: Number(line.active_price || 0) + (line.set_upgrade ? 80 : 0) + (line.modifiers || []).reduce((sum, modifier) => sum + Number(modifier.price_delta || 0), 0),\n            modifiers: (line.modifiers || []).map(modifier => ({ name: modifier.name_en, price: Number(modifier.price_delta || 0) })),\n            notes: line.notes,\n            setUpgrade: Boolean(line.set_upgrade || line.meal_deal),\n            drinkName: drinks.find(drink => drink.id === line.set_drink_menu_item_id)?.name_en,\n          })),\n        }, false);\n        if (printResult.attempted && !printResult.ok) printFailure = printResult.message;\n      }\n\n      setNotice(printFailure\n        ? \`${'${body.data.ticket_number}'} sent to kitchen · Auto print failed: ${'${printFailure}'}\`\n        : \`${'${body.data.ticket_number}'} sent to kitchen${'${printerSettings.autoPrint ? " · Printed" : ""}'}\`);`;

if (!source.includes("const printerSettings = readPosPrinterSettings();")) {
  if (!source.includes(blockFind)) throw new Error("PosRegister checkout marker not found");
  source = source.replace(blockFind, blockReplace);
}

fs.writeFileSync(path, source);
console.log("POS native auto print and callout patch applied");
