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
  InboxIcon,
  TagIcon,
  EnvelopeIcon,
} from "@heroicons/react/24/outline";
import {
  WalletIcon as WalletIconSolid,
  UserGroupIcon as UserGroupIconSolid,
  MagnifyingGlassIcon as MagnifyingGlassIconSolid,
  Cog6ToothIcon as Cog6ToothIconSolid,
  BanknotesIcon as BanknotesIconSolid,
  ClockIcon as ClockIconSolid,
  PlusIcon as PlusIconSolid,
  MinusIcon as MinusIconSolid,
  XMarkIcon as XMarkIconSolid,
  ChevronDownIcon as ChevronDownIconSolid,
  ChevronRightIcon as ChevronRightIconSolid,
  ChevronLeftIcon as ChevronLeftIconSolid,
  CalendarIcon as CalendarIconSolid,
  ArrowRightOnRectangleIcon as ArrowRightOnRectangleIconSolid,
  CheckIcon as CheckIconSolid,
  TrashIcon as TrashIconSolid,
  PencilIcon as PencilIconSolid,
  UserCircleIcon as UserCircleIconSolid,
  InboxIcon as InboxIconSolid,
  TagIcon as TagIconSolid,
  EnvelopeIcon as EnvelopeIconSolid,
} from "@heroicons/react/24/solid";

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
  | "account"
  | "inbox"
  | "tag"
  | "envelope";

const OUTLINE = {
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
  inbox: InboxIcon,
  tag: TagIcon,
  envelope: EnvelopeIcon,
} satisfies Record<IconName, typeof WalletIcon>;

const SOLID = {
  wallet: WalletIconSolid,
  coaches: UserGroupIconSolid,
  oversight: MagnifyingGlassIconSolid,
  settings: Cog6ToothIconSolid,
  topay: BanknotesIconSolid,
  history: ClockIconSolid,
  plus: PlusIconSolid,
  minus: MinusIconSolid,
  close: XMarkIconSolid,
  "chevron-down": ChevronDownIconSolid,
  "chevron-right": ChevronRightIconSolid,
  "chevron-left": ChevronLeftIconSolid,
  calendar: CalendarIconSolid,
  logout: ArrowRightOnRectangleIconSolid,
  check: CheckIconSolid,
  trash: TrashIconSolid,
  pencil: PencilIconSolid,
  account: UserCircleIconSolid,
  inbox: InboxIconSolid,
  tag: TagIconSolid,
  envelope: EnvelopeIconSolid,
} satisfies Record<IconName, typeof WalletIconSolid>;

export function Icon({
  name,
  size = 22,
  strokeWidth = 1.9,
  solid = false,
  ...rest
}: { name: IconName; size?: number; solid?: boolean } & SVGProps<SVGSVGElement>) {
  if (solid) {
    const Glyph = SOLID[name];
    return <Glyph width={size} height={size} {...rest} />;
  }
  const Glyph = OUTLINE[name];
  return <Glyph width={size} height={size} strokeWidth={strokeWidth} {...rest} />;
}
