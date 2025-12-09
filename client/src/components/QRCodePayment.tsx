// PATCH O4 — LIVE QR DISPLAY COMPONENT
import { useEffect, useState } from "react";
import axios from "../lib/axiosInstance";

type Props = {
  amount: number;
};

export default function QRCodePayment({ amount }: Props) {
  const [qr, setQr] = useState("");

  useEffect(() => {
    axios
      .get("/payments-qr/generate?amount=" + amount)
      .then((res) => setQr(res.data.qrImage));
  }, [amount]);

  return (
    <div className="text-center">
      <h2 className="font-bold mb-2">Scan to Pay</h2>
      {qr && <img src={qr} alt="QR Code" className="mx-auto w-64" data-testid="img-qr-code" />}
    </div>
  );
}
