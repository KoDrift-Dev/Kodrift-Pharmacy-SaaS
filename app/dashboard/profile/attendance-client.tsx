"use client";

import { useActionState, useState } from "react";
import { logAttendance, submitLeaveRequest, type ActionState } from "./actions";
import { Clock, CalendarOff, Loader2, LogIn, LogOut, CheckCircle2 } from "lucide-react";

export function AttendanceClient({ staffId, isClockedIn }: { staffId: string, isClockedIn: boolean }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const initialState: ActionState = {};
  const [leaveState, formAction, isLeavePending] = useActionState(submitLeaveRequest, initialState);

  const handleClockToggle = async () => {
    setIsProcessing(true);
    setMessage({ type: "", text: "" });

    const actionType = isClockedIn ? 'Logout' : 'Login';
    const result = await logAttendance(actionType);

    if (result.error) setMessage({ type: "error", text: result.error });
    if (result.success) setMessage({ type: "success", text: result.success });

    setIsProcessing(false);
  };

  return (
    <div className="space-y-6">

      {/* Shift Tracking Card */}
      <div className="bg-white border border-border rounded-3xl p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-teal-soft p-2 rounded-lg border border-teal/20">
            <Clock className="text-teal" size={20} />
          </div>
          <h2 className="text-lg font-heading font-semibold text-teal">Shift Tracking</h2>
        </div>

        {message.text && (
          <div className={`mb-4 p-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 ${message.type === 'error' ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-success-soft text-success border border-success/30'}`}>
            <CheckCircle2 size={16} /> {message.text}
          </div>
        )}

        <div className="flex items-center justify-between p-4 bg-cream/60 rounded-2xl border border-border mb-6">
          <div>
            <p className="text-xs text-ink-mute font-bold uppercase tracking-wider mb-1">Current Status</p>
            <p className={`text-xl font-heading font-semibold ${isClockedIn ? 'text-success' : 'text-ink-mute'}`}>
              {isClockedIn ? 'On Duty' : 'Off Duty'}
            </p>
          </div>

          <button
            onClick={handleClockToggle}
            disabled={isProcessing}
            className={`font-bold py-3 px-6 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center gap-2 ${isClockedIn ? 'bg-red-600 hover:bg-red-500 shadow-red-900/10 text-white' : 'bg-terracotta hover:bg-terracotta-hover shadow-terracotta/20 text-white'}`}
          >
            {isProcessing ? <Loader2 className="animate-spin" size={18} /> : (isClockedIn ? <LogOut size={18} /> : <LogIn size={18} />)}
            {isClockedIn ? 'Clock Out' : 'Clock In'}
          </button>
        </div>
      </div>

      {/* Leave Application Card */}
      <div className="bg-white border border-border rounded-3xl p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-terracotta-dim p-2 rounded-lg border border-terracotta/30">
            <CalendarOff className="text-terracotta-hover" size={20} />
          </div>
          <h2 className="text-lg font-heading font-semibold text-teal">Request Leave</h2>
        </div>

        <form action={formAction} className="space-y-4">

          {leaveState?.error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm font-bold text-center">{leaveState.error}</div>}
          {leaveState?.success && <div className="p-3 bg-success-soft border border-success/30 rounded-xl text-success text-sm font-bold text-center">{leaveState.success}</div>}

          <div>
            <label className="text-[10px] text-ink-mute uppercase font-bold tracking-wider mb-1 block pl-1">Leave Date</label>
            <input type="date" name="leave_date" required className="bg-white border border-border p-3 rounded-xl w-full text-sm focus:border-terracotta outline-none text-ink-dim transition-colors" />
          </div>

          <div>
            <label className="text-[10px] text-ink-mute uppercase font-bold tracking-wider mb-1 block pl-1">Reason</label>
            <textarea name="reason" rows={3} required placeholder="Briefly describe why you need leave..." className="bg-white border border-border p-3 rounded-xl w-full text-sm focus:border-terracotta outline-none text-ink resize-none transition-colors"></textarea>
          </div>

          <button
            type="submit"
            disabled={isLeavePending}
            className="w-full bg-cream hover:bg-teal-soft border border-border hover:border-teal text-ink font-bold py-3.5 rounded-xl transition-all active:scale-95 disabled:opacity-70 flex items-center justify-center gap-2"
          >
            {isLeavePending ? <Loader2 className="animate-spin" size={18} /> : "Submit Request to Admin"}
          </button>
        </form>
      </div>

    </div>
  );
}