import type { SVGProps } from "react";
import { WalletIcon } from "@solar-icons/react/linear/wallet";
import { ChartSquareIcon } from "@solar-icons/react/linear/chart-square";
import { UsersGroupRoundedIcon } from "@solar-icons/react/linear/users-group-rounded";
import { MagnifierIcon } from "@solar-icons/react/linear/magnifier";
import { SettingsIcon } from "@solar-icons/react/linear/settings";
import { BanknoteIcon } from "@solar-icons/react/linear/banknote";
import { ClockCircleIcon } from "@solar-icons/react/linear/clock-circle";
import { HeartPulseIcon } from "@solar-icons/react/linear/heart-pulse";
import { AddIcon } from "@solar-icons/react/linear/add";
import { MinusIcon } from "@solar-icons/react/linear/minus";
import { CloseIcon } from "@solar-icons/react/linear/close";
import { AltArrowDownIcon } from "@solar-icons/react/linear/alt-arrow-down";
import { AltArrowRightIcon } from "@solar-icons/react/linear/alt-arrow-right";
import { AltArrowLeftIcon } from "@solar-icons/react/linear/alt-arrow-left";
import { CalendarIcon } from "@solar-icons/react/linear/calendar";
import { LogoutIcon } from "@solar-icons/react/linear/logout";
import { CheckCircleIcon } from "@solar-icons/react/linear/check-circle";
import { TrashBinTrashIcon } from "@solar-icons/react/linear/trash-bin-trash";
import { PenIcon } from "@solar-icons/react/linear/pen";
import { UserCircleIcon } from "@solar-icons/react/linear/user-circle";
import { InboxIcon } from "@solar-icons/react/linear/inbox";
import { TagIcon } from "@solar-icons/react/linear/tag";
import { LetterIcon } from "@solar-icons/react/linear/letter";
import { WalletIcon as WalletIconBold } from "@solar-icons/react/bold/wallet";
import { ChartSquareIcon as ChartSquareIconBold } from "@solar-icons/react/bold/chart-square";
import { UsersGroupRoundedIcon as UsersGroupRoundedIconBold } from "@solar-icons/react/bold/users-group-rounded";
import { MagnifierIcon as MagnifierIconBold } from "@solar-icons/react/bold/magnifier";
import { SettingsIcon as SettingsIconBold } from "@solar-icons/react/bold/settings";
import { BanknoteIcon as BanknoteIconBold } from "@solar-icons/react/bold/banknote";
import { ClockCircleIcon as ClockCircleIconBold } from "@solar-icons/react/bold/clock-circle";
import { HeartPulseIcon as HeartPulseIconBold } from "@solar-icons/react/bold/heart-pulse";
import { AddIcon as AddIconBold } from "@solar-icons/react/bold/add";
import { MinusIcon as MinusIconBold } from "@solar-icons/react/bold/minus";
import { CloseIcon as CloseIconBold } from "@solar-icons/react/bold/close";
import { AltArrowDownIcon as AltArrowDownIconBold } from "@solar-icons/react/bold/alt-arrow-down";
import { AltArrowRightIcon as AltArrowRightIconBold } from "@solar-icons/react/bold/alt-arrow-right";
import { AltArrowLeftIcon as AltArrowLeftIconBold } from "@solar-icons/react/bold/alt-arrow-left";
import { CalendarIcon as CalendarIconBold } from "@solar-icons/react/bold/calendar";
import { LogoutIcon as LogoutIconBold } from "@solar-icons/react/bold/logout";
import { CheckCircleIcon as CheckCircleIconBold } from "@solar-icons/react/bold/check-circle";
import { TrashBinTrashIcon as TrashBinTrashIconBold } from "@solar-icons/react/bold/trash-bin-trash";
import { PenIcon as PenIconBold } from "@solar-icons/react/bold/pen";
import { UserCircleIcon as UserCircleIconBold } from "@solar-icons/react/bold/user-circle";
import { InboxIcon as InboxIconBold } from "@solar-icons/react/bold/inbox";
import { TagIcon as TagIconBold } from "@solar-icons/react/bold/tag";
import { LetterIcon as LetterIconBold } from "@solar-icons/react/bold/letter";

export type IconName =
  | "wallet"
  | "coaches"
  | "oversight"
  | "insights"
  | "settings"
  | "topay"
  | "history"
  | "clients"
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

const LINEAR = {
  wallet: WalletIcon,
  coaches: UsersGroupRoundedIcon,
  oversight: MagnifierIcon,
  insights: ChartSquareIcon,
  settings: SettingsIcon,
  topay: BanknoteIcon,
  history: ClockCircleIcon,
  clients: HeartPulseIcon,
  plus: AddIcon,
  minus: MinusIcon,
  close: CloseIcon,
  "chevron-down": AltArrowDownIcon,
  "chevron-right": AltArrowRightIcon,
  "chevron-left": AltArrowLeftIcon,
  calendar: CalendarIcon,
  logout: LogoutIcon,
  check: CheckCircleIcon,
  trash: TrashBinTrashIcon,
  pencil: PenIcon,
  account: UserCircleIcon,
  inbox: InboxIcon,
  tag: TagIcon,
  envelope: LetterIcon,
} satisfies Record<IconName, typeof WalletIcon>;

const BOLD = {
  wallet: WalletIconBold,
  coaches: UsersGroupRoundedIconBold,
  oversight: MagnifierIconBold,
  insights: ChartSquareIconBold,
  settings: SettingsIconBold,
  topay: BanknoteIconBold,
  history: ClockCircleIconBold,
  clients: HeartPulseIconBold,
  plus: AddIconBold,
  minus: MinusIconBold,
  close: CloseIconBold,
  "chevron-down": AltArrowDownIconBold,
  "chevron-right": AltArrowRightIconBold,
  "chevron-left": AltArrowLeftIconBold,
  calendar: CalendarIconBold,
  logout: LogoutIconBold,
  check: CheckCircleIconBold,
  trash: TrashBinTrashIconBold,
  pencil: PenIconBold,
  account: UserCircleIconBold,
  inbox: InboxIconBold,
  tag: TagIconBold,
  envelope: LetterIconBold,
} satisfies Record<IconName, typeof WalletIconBold>;

export function Icon({
  name,
  size = 22,
  strokeWidth = 1.9,
  solid = false,
  ...rest
}: { name: IconName; size?: number; solid?: boolean } & SVGProps<SVGSVGElement>) {
  if (solid) {
    const Glyph = BOLD[name];
    return <Glyph size={size} {...rest} />;
  }
  const Glyph = LINEAR[name];
  return <Glyph size={size} strokeWidth={strokeWidth} {...rest} />;
}
