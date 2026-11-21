export type UiScreenId =
  | 'super_admin'
  | 'owner_admin'
  | 'manager_console'
  | 'cashier_kds'
  | 'captain_waiter'
  | 'landing_page';

export type ScreenThemeId =
  | 'obsidian_gold'
  | 'alabaster_editorial'
  | 'emerald_hospitality'
  | 'midnight_sapphire'
  | 'espresso_bistro'
  | 'nordic_slate'
  | 'burgundy_velvet'
  | 'saffron_sunrise';

export type ScreenLayoutStyle = 'sidebar_cards' | 'compact_rail' | 'top_deck';
export type CardRadiusStyle = 'sharp' | 'rounded' | 'soft';

export interface ScreenThemeTokens {
  id: ScreenThemeId;
  nameAr: string;
  nameEn: string;
  taglineAr: string;
  taglineEn: string;
  isDarkShell: boolean;
  canvasBg: string;
  canvasText: string;
  surfaceBg: string;
  surfaceSubtleBg: string;
  surfaceBorder: string;
  surfaceText: string;
  mutedText: string;
  sidebarBg: string;
  sidebarBorder: string;
  sidebarText: string;
  sidebarMuted: string;
  sidebarActiveBg: string;
  sidebarActiveText: string;
  headerBg: string;
  headerBorder: string;
  headerText: string;
  accentHex: string;
  accentTextHex: string;
  cardShadow: string;
  previewSwatches: [string, string, string];
}

export interface UiActionCatalogItem {
  id: string;
  defaultLabelAr: string;
  defaultLabelEn: string;
  iconName: string;
  lockedVisible?: boolean;
}

export interface UiScreenCard {
  id: string;
  titleAr: string;
  titleEn: string;
  buttonIds: string[];
}

export interface UiButtonOverride {
  labelAr?: string;
  labelEn?: string;
  hidden?: boolean;
}

export interface UiScreenConfig {
  themeId: ScreenThemeId;
  layoutStyle: ScreenLayoutStyle;
  cardRadius: CardRadiusStyle;
  accentColorOverride?: string;
  cards: UiScreenCard[];
  buttonOverrides: Record<string, UiButtonOverride>;
}

export interface PlatformUiConfig {
  id: 'ui_config';
  version: number;
  publishedBy: string;
  refreshNoticeAr: string;
  refreshNoticeEn: string;
  screens: Record<UiScreenId, UiScreenConfig>;
  updatedAt?: unknown;
}
