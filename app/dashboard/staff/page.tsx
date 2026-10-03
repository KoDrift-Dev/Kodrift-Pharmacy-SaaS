import { createServer } from "@/lib/supabase/server";
import { StaffForm } from "./staff-form";
import { StaffCard } from "./staff-card";
import { Users } from "lucide-react";

type StaffWithDetails = {
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

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const supabase = await createServer();
  const today = new Date().toISOString().split('T')[0];

  // 1. Fetch All Staff
  const { data: rawStaff, error } = await supabase
    .from("staff")
    .select(
      // SECURITY: never select password_hash — it would leak into client bundles.
      "id, name, role, shift, base_salary, commission_rate, phone, status, email, can_give_discount, can_delete_sales, can_view_reports, cnic_url, created_at"
    )
    .order("created_at", { ascending: true });

  if (error) return <div className="p-4 text-red-600">Failed to load staff: {error.message}</div>;

  const staffList = (rawStaff as StaffWithDetails[]) || [];
  const activeCount = staffList.filter(s => s.status === 'Active').length;

  // 2. NAYA: Fetch All Live Activity (Login/Logout History)
  const { data: allActivity } = await supabase
    .from("staff_activity")
    .select("*")
    .order("created_at", { ascending: false });
    
  const activityLog = allActivity || [];

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20 md:pb-10">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-heading font-semibold text-teal flex items-center gap-3">
            <Users className="text-terracotta" />
            Team Directory & HR
          </h1>
          <p className="text-ink-dim text-sm mt-1">Manage employee profiles, live attendance, and history.</p>
        </div>
        <div className="bg-white border border-border px-5 py-3 rounded-2xl flex items-center gap-4 shadow-sm">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-success-soft border border-success/30">
            <div className="w-3 h-3 rounded-full bg-success animate-pulse"></div>
          </div>
          <div>
            <span className="text-[10px] text-ink-mute uppercase font-bold tracking-wider block">Active Personnel</span>
            <span className="text-xl font-heading font-semibold text-teal leading-none">{activeCount} Members</span>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <StaffForm />
        </div>

        <div className="lg:col-span-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {staffList.length === 0 ? (
              <div className="col-span-2 bg-white border border-border rounded-3xl p-12 text-center border-dashed">
                <p className="text-ink-mute">No staff members registered yet.</p>
              </div>
            ) : (
              staffList.map((person) => {
                // Filter activity specific to this person
                const personActivity = activityLog.filter(a => a.staff_id === person.id);
                // Get latest action to see if they are currently clocked in
                const latestAction = personActivity.find(a => a.type === 'Login' || a.type === 'Logout');
                const isCurrentlyClockedIn = latestAction?.type === 'Login';

                return (
                  <StaffCard 
                    key={person.id} 
                    person={person} 
                    isElevated={person.role === 'Super Admin' || person.role === 'Admin'}
                    isManager={person.role === 'Manager'}
                    activityLog={personActivity}
                    isClockedIn={isCurrentlyClockedIn}
                  />
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}