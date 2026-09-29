import { useNavigate } from "react-router-dom";
import { ClassCalendarScreen } from "./ClassCalendar";

/** Front-desk class schedule: a full-screen calendar. Open a class to mark
 * arrivals and collect pay-at-desk; the department head manages the classes
 * themselves elsewhere. */
export function DeskClasses() {
  const navigate = useNavigate();
  return <ClassCalendarScreen onClose={() => navigate("/")} />;
}
