import type { SVGProps } from "react";
import {
  WalletIcon,
  UserGroupIcon,
  MagnifyingGlassIcon,
  Cog6ToothIcon,
  BanknotesIcon,
  ClockIcon,
  PlusIcon,
  MinusIcon,
  XMarkIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronLeftIcon,
  CalendarIcon,
  ArrowRightOnRectangleIcon,
  CheckIcon,
  TrashIcon,
  PencilIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";

export type IconName =
  | "wallet"
  | "coaches"
  | "oversight"
  | "settings"
  | "topay"
  | "history"
  | "plus"
  | "minus"
  | "close"
  | "chevron-down"
  | "chevron-right"
  | "chevron-left"
  | "calendar"
  | "logout"
  | "check"
  | "trash"
  | "pencil"
  | "account";

const ICONS = {
  wallet: WalletIcon,
  coaches: UserGroupIcon,
  oversight: MagnifyingGlassIcon,
  settings: Cog6ToothIcon,
  topay: BanknotesIcon,
  history: ClockIcon,
  plus: PlusIcon,
  minus: MinusIcon,
  close: XMarkIcon,
  "chevron-down": ChevronDownIcon,
  "chevron-right": ChevronRightIcon,
  "chevron-left": ChevronLeftIcon,
  calendar: CalendarIcon,
  logout: ArrowRightOnRectangleIcon,
  check: CheckIcon,
  trash: TrashIcon,
  pencil: PencilIcon,
  account: UserCircleIcon,
} satisfies Record<IconName, typeof WalletIcon>;

export function Icon({
  name,
  size = 22,
  strokeWidth = 1.9,
  ...rest
}: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  const Glyph = ICONS[name];
  return <Glyph width={size} height={size} strokeWidth={strokeWidth} {...rest} />;
}
