// PATCH O4 — LIVE QR DISPLAY COMPONENT
// PATCH O5 — ACCEPTS ORDER NUMBER FOR SCB REFERENCE
import { useEffect, useState } from "react";
import axios from "../utils/axiosInstance";

type Props = {
  amount: number;
  orderNumber?: string;
};

export default function QRCodePayment({ amount, orderNumber }: Props) {
  const [qr, setQr] = useState("");

  useEffect(() => {
    const ref = orderNumber || "";
    axios
      .get(`/payments-qr/generate?amount=${amount}&ref=${ref}`)
      .then((res) => setQr(res.data.qrImage));
  }, [amount, orderNumber]);

  return (
    <div className="text-center">
      <h2 className="font-bold mb-2">Scan to Pay</h2>
      {qr && <img src={qr} alt="QR Code" className="mx-auto w-64" data-testid="img-qr-code" />}
    </div>
  );
}
