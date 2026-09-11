# Back Office Onboarding Runbook

This runbook is both implementation guidance and the copy baseline for the in-product Setup & Onboarding experience.

## Onboarding home

Back Office should show a persistent setup progress card until the business is ready:

1. Business details
2. Location
3. Employees
4. Devices
5. Menu & pricing
6. Payments
7. Printer / cash drawer
8. First transaction
9. Reporting verification
10. Ready to trade

Each step must show: status, short explanation, action button, help link, and ability to re-open later.

## Device setup — customer-facing instructions

### Step 1 — Add a device
In Back Office open **Settings → Devices** and select **Add Device**.

Enter a friendly name such as `Main Counter`, `Kitchen Screen` or `Customer Screen`.

### Step 2 — Choose what the device does
Select one role:

- **POS Register** — takes orders and payments
- **Kitchen Display** — receives and manages kitchen tickets
- **Customer Display** — shows customer-facing order status

Select the business location/store and save the device.

### Step 3 — Install Customli
On the Android device, use the **Download Customli for Android** action in Back Office.

The customer must not be asked to select a POS/KDS/CDS APK. There is one Customli Android application and Back Office assigns the role.

### Step 4 — Open Customli
Open the installed Customli app. If the device has not been paired, the app shows **Connect this device**.

### Step 5 — Pair the device
Back Office displays a six-digit, single-use code. Enter that code into Customli and select **Connect Device**.

The code expires after 10 minutes. If it expires, use **Generate new code** in Back Office.

The customer never enters a backend token, API key, server address, SSH command or terminal command.

### Step 6 — Confirm connection
Back Office should automatically change the device status from **Pending** to **Active** and display:

- device name
- assigned role
- location
- Android/iOS platform
- app version
- OS version
- last seen

The app launches the function assigned by Back Office.

### Step 7 — Test the role
For POS Register: open the register and confirm menu/shift connection.

For Kitchen Display: confirm the kitchen queue loads.

For Customer Display: confirm the customer order-status screen loads.

### Step 8 — Hardware setup where required
POS Register setup continues to printer/cash drawer onboarding:

1. connect printer
2. print test receipt
3. verify kitchen ticket routing if used
4. open cash drawer test
5. mark hardware test passed

### Step 9 — First transaction
Back Office should guide the business through one test transaction and verify:

- POS order created
- KDS receives it
- order status flows through Ready/Complete
- Customer Display updates
- receipt prints
- sale appears in SBB/Customli reporting

### Step 10 — Device ready
When required checks pass, Back Office marks the device **Ready**.

## Replacement / lost device

From Back Office, owner selects the old device and uses **Revoke**. The credential becomes unusable. A replacement device is created or re-paired using the normal onboarding flow.

## Product rules

- Samsung is not a product requirement. Android is the supported platform for the current release.
- iOS must not be marketed as supported until a real iOS application and hardware compatibility path are certified.
- No customer onboarding step may require server or terminal access.
- Device role is server-assigned.
- Device identity and employee identity are separate.
- Technical compatibility tokens may exist internally during migration but must never be exposed as a normal installation workflow.

## In-product help requirements

Every onboarding screen should include:

- plain-language explanation of why the step is needed
- `Need help?` expandable instructions
- retry/recover action
- visible completion state
- no developer terminology unless placed in an explicitly advanced support section

This runbook should be updated whenever the production onboarding flow changes.