import { createServer } from "@/lib/supabase/server";
import { AttendanceClient } from "./attendance-client";
import { UserCircle, Shield, Phone, Moon, Activity, Banknote, Percent, Lock, Tag, Trash2, BarChart2, FileBadge } from "lucide-react";
import Link from "next/link";

// Updated Type to include all our new fields
type StaffProfile = {
  id: string;
  name: string;
  role: string;
  shift: string;
  base_salary: number;
  commission_rate: number;
  phone: string;
  status: string;
  email: string;
  can_give_discount: boolean;
  can_delete_sales: boolean;
  can_view_reports: boolean;
  cnic_url: string | null;
  created_at: string;
};

type StaffActivity = {
  id: string;
  staff_id: string;
  type: string;
  status: string;
  details: string;
  created_at: string;
};

export const dynamic = "force-dynamic";

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ viewAs?: string }> }) {
  const { viewAs } = await searchParams;
  const supabase = await createServer();

  // SECURITY: explicit columns — password_hash must never reach the client.
  const { data: allStaff } = await supabase
    .from("staff")
    .select("id, name, role, shift, base_salary, commission_rate, phone, status, email, can_give_discount, can_delete_sales, can_view_reports, cnic_url, created_at")
    .order("name");
  const staffMembers = (allStaff as StaffProfile[]) || [];

  const currentUser = staffMembers.find(s => s.id === viewAs) || staffMembers[0];

  if (!currentUser) {
    return (
      <div className="max-w-7xl mx-auto text-center p-10 bg-white rounded-3xl border border-border shadow-sm">
        <h2 className="text-xl text-teal font-heading font-semibold">No Staff Found</h2>
        <p className="text-ink-dim mt-2">Please add a staff member in the Team Directory first.</p>
        <Link href="/dashboard/staff" className="text-terracotta mt-4 inline-block hover:underline">Go to Staff Directory</Link>
      </div>
    );
  }

  const { data: rawActivity } = await supabase
    .from("staff_activity")
    .select("*")
    .eq("staff_id", currentUser.id)
    .order("created_at", { ascending: false })
    .limit(10);

  const activityLog = (rawActivity as StaffActivity[]) || [];

  const lastLoginAction = activityLog.find(a => a.type === 'Login' || a.type === 'Logout');
  const isClockedIn = lastLoginAction?.type === 'Login';

  const isElevated = currentUser.role === 'Super Admin' || currentUser.role === 'Admin';
  const isManager = currentUser.role === 'Manager';

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20 md:pb-10">

      {/* ENTERPRISE SHOWCASE SIMULATOR */}
      <div className="bg-teal-soft border border-teal/20 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 mb-8">
        <div>
          <h4 className="text-teal font-bold text-sm uppercase tracking-wider flex items-center gap-2">
            <Shield size={16} /> Enterprise Showcase Mode
          </h4>
          <p className="text-ink-dim text-xs mt-1">Select a profile below to simulate what that user sees.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {staffMembers.map(staff => (
            <Link
              key={staff.id}
              href={`/dashboard/profile?viewAs=${staff.id}`}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all border ${currentUser.id === staff.id ? 'bg-teal text-white border-teal' : 'bg-white text-ink-dim border-border hover:border-teal'}`}
            >
              {staff.name} ({staff.role})
            </Link>
          ))}
        </div>
      </div>

      <header className="mb-6">
        <h1 className="text-2xl md:text-3xl font-heading font-semibold text-teal">My Profile & Portal</h1>
        <p className="text-ink-dim text-sm mt-1">Manage your details, track attendance, and view your permissions.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* LEFT COLUMN: Identity Card */}
        <div className="lg:col-span-1">
          <div className="bg-white border border-border rounded-3xl overflow-hidden shadow-sm h-full flex flex-col">
            <div className={`h-24 ${isElevated ? 'bg-terracotta-dim' : isManager ? 'bg-teal-soft' : 'bg-cream'}`}></div>

            <div className="px-6 pb-6 relative flex-1 flex flex-col">
              <div className="w-20 h-20 bg-white border-4 border-white rounded-full flex items-center justify-center absolute -top-10 left-6 shadow-md">
                <UserCircle className="text-ink-mute" size={48} />
              </div>

              <div className="pt-14">
                <h2 className="text-2xl font-heading font-semibold text-ink">{currentUser.name}</h2>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md mt-2 bg-cream border border-border">
                  <Shield size={12} className={isElevated ? 'text-terracotta-hover' : isManager ? 'text-teal' : 'text-ink-mute'} />
                  <span className={`text-[10px] uppercase font-bold tracking-wider ${isElevated ? 'text-terracotta-hover' : isManager ? 'text-teal' : 'text-ink-mute'}`}>
                    {currentUser.role}
                  </span>
                </div>
              </div>

              <div className="mt-8 space-y-4 flex-1">
                <div className="flex items-center gap-3">
                  <div className="bg-cream p-2 rounded-lg border border-border text-ink-dim"><Phone size={16} /></div>
                  <div>
                    <p className="text-[10px] font-bold text-ink-mute uppercase tracking-wider">Phone</p>
                    <p className="text-sm font-medium text-ink-dim">{currentUser.phone || "Not provided"}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="bg-cream p-2 rounded-lg border border-border text-ink-dim"><Moon size={16} /></div>
                  <div>
                    <p className="text-[10px] font-bold text-ink-mute uppercase tracking-wider">Assigned Shift</p>
                    <p className="text-sm font-medium text-ink-dim">{currentUser.shift || "Flexible"}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                   <div className="bg-cream/50 rounded-xl p-3 border border-border">
                      <div className="text-[10px] text-ink-mute uppercase font-bold flex items-center gap-1 mb-1"><Banknote size={12}/> Salary</div>
                      <div className="text-sm font-bold text-ink">Rs {Math.round(currentUser.base_salary || 0).toLocaleString()}</div>
                   </div>
                   <div className="bg-teal-soft/50 rounded-xl p-3 border border-teal/20">
                      <div className="text-[10px] text-teal/80 uppercase font-bold flex items-center gap-1 mb-1"><Percent size={12}/> Comm.</div>
                      <div className="text-sm font-bold text-teal">{currentUser.commission_rate || 0}%</div>
                   </div>
                </div>
              </div>

              {/* Security & Docs Footer */}
              <div className="mt-6 pt-4 border-t border-border space-y-3">
                <div>
                  <p className="text-[10px] font-bold text-ink-mute uppercase tracking-wider mb-2">My Permissions</p>
                  <div className="flex flex-wrap gap-1.5">
                    {currentUser.can_give_discount && <span className="bg-teal/10 text-teal text-[9px] font-bold px-2 py-1 rounded flex items-center gap-1"><Tag size={10}/> Discounts</span>}
                    {currentUser.can_delete_sales && <span className="bg-red-100 text-red-600 text-[9px] font-bold px-2 py-1 rounded flex items-center gap-1"><Trash2 size={10}/> Delete Sales</span>}
                    {currentUser.can_view_reports && <span className="bg-teal/10 text-teal text-[9px] font-bold px-2 py-1 rounded flex items-center gap-1"><BarChart2 size={10}/> Reports</span>}
                    {!currentUser.can_give_discount && !currentUser.can_delete_sales && !currentUser.can_view_reports && !isElevated && (
                      <span className="bg-cream text-ink-mute text-[9px] font-bold px-2 py-1 rounded flex items-center gap-1"><Lock size={10}/> Standard POS Access</span>
                    )}
                  </div>
                </div>

                {currentUser.cnic_url && (
                  <div className="pt-2">
                    <a href={currentUser.cnic_url} target="_blank" className="inline-flex items-center gap-2 px-3 py-2 bg-ink text-white rounded-lg text-xs font-bold hover:bg-ink-dim transition-colors">
                      <FileBadge size={14} /> View My ID / License Document
                    </a>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>

        {/* MIDDLE COLUMN: Actions */}
        <div className="lg:col-span-1">
          <AttendanceClient staffId={currentUser.id} isClockedIn={isClockedIn} />
        </div>

        {/* RIGHT COLUMN: Activity Log */}
        <div className="lg:col-span-1">
          <div className="bg-white border border-border rounded-3xl p-6 shadow-sm h-full max-h-[600px] flex flex-col">
            <div className="flex items-center gap-3 mb-6 flex-none">
              <div className="bg-teal-soft p-2 rounded-lg border border-teal/20">
                <Activity className="text-teal" size={20} />
              </div>
              <h2 className="text-lg font-heading font-semibold text-teal">Recent Activity</h2>
            </div>

            {activityLog.length === 0 ? (
              <p className="text-ink-mute text-sm text-center mt-10">No recent activity recorded.</p>
            ) : (
              <div className="space-y-4 overflow-y-auto custom-scrollbar flex-1 pr-2">
                {activityLog.map(log => (
                  <div key={log.id} className="flex gap-4 p-3 bg-cream/60 rounded-xl border border-border">
                    <div className="flex-none pt-1">
                      {log.type === 'Login' && <div className="w-2.5 h-2.5 rounded-full bg-success"></div>}
                      {log.type === 'Logout' && <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>}
                      {log.type === 'LeaveRequest' && <div className="w-2.5 h-2.5 rounded-full bg-terracotta"></div>}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-ink">{log.type === 'LeaveRequest' ? 'Leave Requested' : `Clocked ${log.type === 'Login' ? 'In' : 'Out'}`}</p>
                      <p className="text-xs text-ink-mute mb-1">{new Date(log.created_at).toLocaleString()}</p>
                      {log.details && <p className="text-xs text-ink-dim bg-white p-2.5 rounded-lg mt-2 border border-border/70 shadow-sm leading-relaxed">{log.details}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}