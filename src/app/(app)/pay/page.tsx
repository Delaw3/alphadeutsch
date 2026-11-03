"use client";

import { CreditCard } from "lucide-react";
import { MobileCard, MobileScreen } from "@/components/mobile/MobileScreen";

const PAYMENT_URL = "https://portal.alphadeutsch.com/payment.php";

export default function PayPage() {
  return (
    <MobileScreen
      eyebrow="Payment"
      title="Pay your course fees"
      description="Tap the button below to open the Alpha Deutsch payment portal."
    >
      <MobileCard>
        <div className="flex flex-col items-center gap-5 py-4 text-center">
          <CreditCard size={48} strokeWidth={2} />
          <p className="text-sm leading-6 text-app-muted">
            Payments are processed securely through the Alpha Deutsch portal.
            You will be taken to{" "}
            <span className="font-bold text-app-text">portal.alphadeutsch.com</span>.
          </p>
          <a
            href={PAYMENT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="focus-ring inline-flex min-h-[52px] w-full max-w-xs items-center justify-center rounded-full bg-app-accent text-sm font-black text-app-on-accent transition active:scale-[0.98]"
          >
            Open payment portal ↗
          </a>
          <p className="text-[12px] text-app-muted">
            After payment, your status will update within 24 hours. Contact Alpha Deutsch if you need help.
          </p>
        </div>
      </MobileCard>
    </MobileScreen>
  );
}

