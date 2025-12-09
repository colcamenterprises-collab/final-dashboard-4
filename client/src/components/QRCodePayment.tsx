// PATCH O6 — FRONTEND QR (DYNAMIC QR BACKEND)
import axios from "axios";
import { useEffect, useState } from "react";

export default function QRCodePayment({ amount, orderNumber }: { amount: number; orderNumber?: string }) {
  const [qr, setQr] = useState<any>(null);

  useEffect(() => {
    axios
      .get(`/api/payments/qr/dynamic?amount=${amount}&ref=${orderNumber}`)
      .then((res) => setQr(res.data))
      .catch(() => setQr(null));
  }, [amount, orderNumber]);

  if (!qr) return <div>Loading QR...</div>;

  return (
    <div>
      <img
        src={qr.qrImage || "/placeholder_qr.png"}
        alt="QR Code"
        style={{ width: 260, height: 260 }}
        data-testid="img-qr-code"
      />
      <div className="mt-2 text-center">
        Reference: <b>{qr.ref}</b>
        <br />
        Mode: <b>{qr.mode}</b>
      </div>
    </div>
  );
}
