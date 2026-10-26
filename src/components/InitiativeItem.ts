export interface InitiativeItem {
  id: string;
  name: string;
  url: string;
  visible: boolean;
  active: boolean;
  count: string;
  ready: boolean;
  group: number;
  groupIndex: number;
  /** The token whose turn this token takes along with, if any */
  linkedTo?: string;
}
