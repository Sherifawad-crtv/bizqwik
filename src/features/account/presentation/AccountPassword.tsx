import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../shared/auth";
import { useSetHeader } from "../../../shared/screen/header";
import { useChangePassword } from "./hooks/useAccountActions";
import { Button } from "../../../design-system/components/Button";
import { TextField } from "../../../design-system/components/FormField";

export function AccountPassword() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const { change, busy, error } = useChangePassword(profile?.email ?? "");

  useSetHeader({ kicker: "ACCOUNT", title: "Change password" }, []);

  if (!profile) return null;

  const save = async () => {
    if (await change(current, next, confirm)) navigate("/account", { replace: true });
  };

  return (
    <div>
      <div className="bq-card bq-card--md">
        <div className="bq-stack">
          <TextField
            label="CURRENT PASSWORD"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
          <TextField
            label="NEW PASSWORD"
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
          <TextField
            label="CONFIRM NEW PASSWORD"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        {error && (
          <div  className="bq-error bq-error--spaced bq-rise">
            {error}
          </div>
        )}
        <Button className="bq-mt-4" fullWidth size="lg" disabled={busy} onClick={save}>
          {busy ? "Saving…" : "Save password"}
        </Button>
      </div>
    </div>
  );
}
