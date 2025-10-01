/**
 * Globalization Service
 * Multi-language support and international compliance for global film production
 */

import { structuredLogger } from "../utils/logger";
import { z } from "zod";

// Globalization schemas
export const LocaleSchema = z.object({
  code: z.string().regex(/^[a-z]{2}-[A-Z]{2}$/), // e.g., en-US, fr-FR, de-DE
  name: z.string(),
  nativeName: z.string(),
  direction: z.enum(["ltr", "rtl"]),
  enabled: z.boolean(),
  completeness: z.number().min(0).max(1), // Translation completeness
  fallbackLocale: z.string().optional()
});

export const TranslationSchema = z.object({
  translationId: z.string(),
  locale: z.string(),
  key: z.string(),
  value: z.string(),
  context: z.string().optional(),
  pluralForm: z.enum(["zero", "one", "two", "few", "many", "other"]).optional(),
  approved: z.boolean(),
  translatedBy: z.string(),
  translatedAt: z.date(),
  reviewedBy: z.string().optional(),
  reviewedAt: z.date().optional()
});

export const RegionalComplianceSchema = z.object({
  region: z.string(),
  country: z.string(),
  requirements: z.object({
    dataProtection: z.object({
      regulation: z.string(), // GDPR, CCPA, etc.
      consentRequired: z.boolean(),
      dataRetentionDays: z.number(),
      rightToDelete: z.boolean(),
      dataPortability: z.boolean()
    }),
    labor: z.object({
      maxWorkingHours: z.number(),
      overtimeRegulations: z.string(),
      breakRequirements: z.string(),
      unionCompliance: z.boolean()
    }),
    tax: z.object({
      vatRequired: z.boolean(),
      taxRegistration: z.string().optional(),
      invoiceRequirements: z.string()
    }),
    accessibility: z.object({
      wcagLevel: z.enum(["A", "AA", "AAA"]),
      screenReaderSupport: z.boolean(),
      keyboardNavigation: z.boolean()
    })
  }),
  implementationStatus: z.enum(["planning", "in_progress", "compliant", "non_compliant"]),
  lastAudit: z.date().optional()
});

export type Locale = z.infer<typeof LocaleSchema>;
export type Translation = z.infer<typeof TranslationSchema>;
export type RegionalCompliance = z.infer<typeof RegionalComplianceSchema>;

/**
 * Globalization Service
 */
export class GlobalizationService {
  private locales: Map<string, Locale> = new Map();
  private translations: Map<string, Map<string, Translation>> = new Map(); // locale -> key -> translation
  private complianceRequirements: Map<string, RegionalCompliance> = new Map();
  private currentLocale = 'en-US';
  private fallbackLocale = 'en-US';

  // Regional film industry standards
  private filmIndustryStandards = {
    timeFormats: new Map<string, string>(),
    dateFormats: new Map<string, string>(),
    currencyFormats: new Map<string, Intl.NumberFormatOptions>(),
    numberFormats: new Map<string, Intl.NumberFormatOptions>(),
    scheduleFormats: new Map<string, any>()
  };

  constructor() {
    this.initializeSupportedLocales();
    this.initializeFilmIndustryStandards();
    this.initializeComplianceRequirements();
  }

  /**
   * Add or update locale
   */
  async addLocale(locale: Omit<Locale, 'completeness'>): Promise<void> {
    try {
      // Calculate translation completeness
      const completeness = await this.calculateTranslationCompleteness(locale.code);
      
      const fullLocale: Locale = {
        ...locale,
        completeness
      };

      LocaleSchema.parse(fullLocale);
      this.locales.set(locale.code, fullLocale);

      structuredLogger.info("Locale added", {
        code: locale.code,
        name: locale.name,
        completeness
      });

    } catch (error) {
      structuredLogger.error("Failed to add locale", {
        error: error instanceof Error ? error.message : String(error),
        locale
      });
      throw error;
    }
  }

  /**
   * Add translation
   */
  async addTranslation(translation: Omit<Translation, 'translationId' | 'translatedAt'>): Promise<string> {
    try {
      const fullTranslation: Translation = {
        translationId: this.generateTranslationId(),
        translatedAt: new Date(),
        ...translation
      };

      TranslationSchema.parse(fullTranslation);

      // Ensure locale map exists
      if (!this.translations.has(translation.locale)) {
        this.translations.set(translation.locale, new Map());
      }

      this.translations.get(translation.locale)!.set(translation.key, fullTranslation);

      // Update locale completeness
      await this.updateLocaleCompleteness(translation.locale);

      structuredLogger.debug("Translation added", {
        translationId: fullTranslation.translationId,
        locale: translation.locale,
        key: translation.key
      });

      return fullTranslation.translationId;

    } catch (error) {
      structuredLogger.error("Failed to add translation", {
        error: error instanceof Error ? error.message : String(error),
        translation
      });
      throw error;
    }
  }

  /**
   * Get translated text
   */
  t(key: string, locale?: string, interpolationData?: Record<string, any>): string {
    const targetLocale = locale || this.currentLocale;
    
    // Try to get translation for target locale
    let translation = this.getTranslationForLocale(key, targetLocale);
    
    // Fall back to fallback locale if not found
    if (!translation) {
      const fallbackLocaleName = this.locales.get(targetLocale)?.fallbackLocale || this.fallbackLocale;
      translation = this.getTranslationForLocale(key, fallbackLocaleName);
    }
    
    // Fall back to key if no translation found
    if (!translation) {
      structuredLogger.warn("Translation not found", { key, locale: targetLocale });
      return key;
    }

    // Perform interpolation if data provided
    if (interpolationData) {
      return this.interpolateTranslation(translation.value, interpolationData);
    }

    return translation.value;
  }

  /**
   * Format date according to locale
   */
  formatDate(date: Date, locale?: string, options?: Intl.DateTimeFormatOptions): string {
    const targetLocale = locale || this.currentLocale;
    
    const defaultOptions: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    };

    return new Intl.DateTimeFormat(targetLocale, { ...defaultOptions, ...options }).format(date);
  }

  /**
   * Format time according to film industry standards
   */
  formatTime(date: Date, locale?: string, format?: 'call_time' | 'wrap_time' | 'standard'): string {
    const targetLocale = locale || this.currentLocale;
    const filmFormat = format || 'standard';
    
    // Film industry specific time formatting
    switch (filmFormat) {
      case 'call_time':
        return new Intl.DateTimeFormat(targetLocale, {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false // 24-hour format preferred in film industry
        }).format(date) + ' CALL';
        
      case 'wrap_time':
        return new Intl.DateTimeFormat(targetLocale, {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }).format(date) + ' WRAP';
        
      default:
        return new Intl.DateTimeFormat(targetLocale, {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        }).format(date);
    }
  }

  /**
   * Format currency according to locale
   */
  formatCurrency(amount: number, currency: string, locale?: string): string {
    const targetLocale = locale || this.currentLocale;
    
    return new Intl.NumberFormat(targetLocale, {
      style: 'currency',
      currency: currency
    }).format(amount);
  }

  /**
   * Format schedule according to regional standards
   */
  formatSchedule(scheduleData: any, locale?: string): any {
    const targetLocale = locale || this.currentLocale;
    
    return {
      ...scheduleData,
      callTime: this.formatTime(new Date(scheduleData.callTime), targetLocale, 'call_time'),
      wrapTime: this.formatTime(new Date(scheduleData.wrapTime), targetLocale, 'wrap_time'),
      date: this.formatDate(new Date(scheduleData.date), targetLocale),
      location: this.localizeLocation(scheduleData.location, targetLocale),
      crew: scheduleData.crew?.map((member: any) => ({
        ...member,
        role: this.t(`crew.role.${member.role}`, targetLocale),
        department: this.t(`crew.department.${member.department}`, targetLocale)
      }))
    };
  }

  /**
   * Get compliance requirements for region
   */
  getComplianceRequirements(region: string): RegionalCompliance | null {
    return this.complianceRequirements.get(region) || null;
  }

  /**
   * Validate GDPR compliance
   */
  async validateGDPRCompliance(userdata: any, userLocale: string): Promise<{
    compliant: boolean;
    issues: string[];
    requiredActions: string[];
  }> {
    const issues: string[] = [];
    const requiredActions: string[] = [];

    // Check if user is in GDPR region
    const isEU = this.isEULocale(userLocale);
    if (!isEU) {
      return { compliant: true, issues, requiredActions };
    }

    // Check consent
    if (!userdata.gdprConsent) {
      issues.push("Missing GDPR consent");
      requiredActions.push("Obtain explicit user consent for data processing");
    }

    // Check data minimization
    if (this.hasExcessiveDataCollection(userdata)) {
      issues.push("Excessive data collection detected");
      requiredActions.push("Reduce data collection to necessary minimum");
    }

    // Check data retention
    if (this.exceedsDataRetention(userdata)) {
      issues.push("Data retention period exceeded");
      requiredActions.push("Implement automated data deletion");
    }

    return {
      compliant: issues.length === 0,
      issues,
      requiredActions
    };
  }

  /**
   * Generate localized legal documents
   */
  async generateLocalizedLegalDocs(
    templateType: 'privacy_policy' | 'terms_of_service' | 'data_processing_agreement',
    locale: string,
    customizations?: Record<string, any>
  ): Promise<{
    document: string;
    lastUpdated: Date;
    jurisdiction: string;
    complianceLevel: string;
  }> {
    try {
      const region = this.getRegionFromLocale(locale);
      const compliance = this.complianceRequirements.get(region);
      
      if (!compliance) {
        throw new Error(`No compliance requirements found for region: ${region}`);
      }

      // Load template
      const template = await this.loadLegalTemplate(templateType, locale);
      
      // Apply customizations and compliance requirements
      const processedDocument = this.processLegalTemplate(template, compliance, customizations);

      return {
        document: processedDocument,
        lastUpdated: new Date(),
        jurisdiction: region,
        complianceLevel: compliance.implementationStatus
      };

    } catch (error) {
      structuredLogger.error("Failed to generate localized legal document", {
        error: error instanceof Error ? error.message : String(error),
        templateType,
        locale
      });
      throw error;
    }
  }

  /**
   * Get supported locales
   */
  getSupportedLocales(): Locale[] {
    return Array.from(this.locales.values());
  }

  /**
   * Set current locale
   */
  setLocale(locale: string): void {
    if (!this.locales.has(locale)) {
      structuredLogger.warn("Unsupported locale, falling back to default", {
        requestedLocale: locale,
        fallbackLocale: this.fallbackLocale
      });
      locale = this.fallbackLocale;
    }

    this.currentLocale = locale;
    structuredLogger.info("Locale changed", { locale });
  }

  /**
   * Get translation statistics
   */
  getTranslationStats(): {
    totalKeys: number;
    locales: Array<{
      code: string;
      name: string;
      completeness: number;
      translatedKeys: number;
      pendingKeys: number;
    }>;
    mostTranslated: string;
    leastTranslated: string;
  } {
    const baseLocaleTranslations = this.translations.get(this.fallbackLocale);
    const totalKeys = baseLocaleTranslations?.size || 0;

    const localeStats = Array.from(this.locales.values()).map(locale => {
      const translations = this.translations.get(locale.code);
      const translatedKeys = translations?.size || 0;
      
      return {
        code: locale.code,
        name: locale.name,
        completeness: locale.completeness,
        translatedKeys,
        pendingKeys: totalKeys - translatedKeys
      };
    });

    // Sort by completeness
    localeStats.sort((a, b) => b.completeness - a.completeness);

    return {
      totalKeys,
      locales: localeStats,
      mostTranslated: localeStats[0]?.code || 'none',
      leastTranslated: localeStats[localeStats.length - 1]?.code || 'none'
    };
  }

  // Private helper methods
  private getTranslationForLocale(key: string, locale: string): Translation | null {
    const localeTranslations = this.translations.get(locale);
    return localeTranslations?.get(key) || null;
  }

  private interpolateTranslation(template: string, data: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key]?.toString() || match;
    });
  }

  private async calculateTranslationCompleteness(locale: string): Promise<number> {
    const baseLocaleTranslations = this.translations.get(this.fallbackLocale);
    const targetLocaleTranslations = this.translations.get(locale);
    
    if (!baseLocaleTranslations || baseLocaleTranslations.size === 0) {
      return 0;
    }

    const totalKeys = baseLocaleTranslations.size;
    const translatedKeys = targetLocaleTranslations?.size || 0;
    
    return translatedKeys / totalKeys;
  }

  private async updateLocaleCompleteness(locale: string): Promise<void> {
    const localeObj = this.locales.get(locale);
    if (localeObj) {
      localeObj.completeness = await this.calculateTranslationCompleteness(locale);
    }
  }

  private initializeSupportedLocales(): void {
    const supportedLocales: Omit<Locale, 'completeness'>[] = [
      { code: 'en-US', name: 'English (US)', nativeName: 'English', direction: 'ltr', enabled: true },
      { code: 'en-GB', name: 'English (UK)', nativeName: 'English', direction: 'ltr', enabled: true, fallbackLocale: 'en-US' },
      { code: 'fr-FR', name: 'French (France)', nativeName: 'Français', direction: 'ltr', enabled: true, fallbackLocale: 'en-US' },
      { code: 'de-DE', name: 'German (Germany)', nativeName: 'Deutsch', direction: 'ltr', enabled: true, fallbackLocale: 'en-US' },
      { code: 'es-ES', name: 'Spanish (Spain)', nativeName: 'Español', direction: 'ltr', enabled: true, fallbackLocale: 'en-US' },
      { code: 'it-IT', name: 'Italian (Italy)', nativeName: 'Italiano', direction: 'ltr', enabled: true, fallbackLocale: 'en-US' },
      { code: 'pt-BR', name: 'Portuguese (Brazil)', nativeName: 'Português', direction: 'ltr', enabled: true, fallbackLocale: 'en-US' },
      { code: 'zh-CN', name: 'Chinese (Simplified)', nativeName: '简体中文', direction: 'ltr', enabled: true, fallbackLocale: 'en-US' },
      { code: 'ja-JP', name: 'Japanese', nativeName: '日本語', direction: 'ltr', enabled: true, fallbackLocale: 'en-US' },
      { code: 'ko-KR', name: 'Korean', nativeName: '한국어', direction: 'ltr', enabled: true, fallbackLocale: 'en-US' },
      { code: 'ar-SA', name: 'Arabic (Saudi Arabia)', nativeName: 'العربية', direction: 'rtl', enabled: true, fallbackLocale: 'en-US' },
      { code: 'he-IL', name: 'Hebrew (Israel)', nativeName: 'עברית', direction: 'rtl', enabled: true, fallbackLocale: 'en-US' }
    ];

    supportedLocales.forEach(locale => {
      this.addLocale(locale).catch(error => {
        structuredLogger.error("Failed to initialize locale", {
          locale: locale.code,
          error: error.message
        });
      });
    });
  }

  private initializeFilmIndustryStandards(): void {
    // Time formats for different regions
    this.filmIndustryStandards.timeFormats.set('en-US', '24-hour');
    this.filmIndustryStandards.timeFormats.set('en-GB', '24-hour');
    this.filmIndustryStandards.timeFormats.set('fr-FR', '24-hour');
    this.filmIndustryStandards.timeFormats.set('de-DE', '24-hour');

    // Currency formats
    this.filmIndustryStandards.currencyFormats.set('en-US', { currency: 'USD' });
    this.filmIndustryStandards.currencyFormats.set('en-GB', { currency: 'GBP' });
    this.filmIndustryStandards.currencyFormats.set('fr-FR', { currency: 'EUR' });
    this.filmIndustryStandards.currencyFormats.set('de-DE', { currency: 'EUR' });
  }

  private initializeComplianceRequirements(): void {
    // GDPR (EU)
    const gdprCompliance: RegionalCompliance = {
      region: 'EU',
      country: 'European Union',
      requirements: {
        dataProtection: {
          regulation: 'GDPR',
          consentRequired: true,
          dataRetentionDays: 365,
          rightToDelete: true,
          dataPortability: true
        },
        labor: {
          maxWorkingHours: 48,
          overtimeRegulations: 'EU Working Time Directive',
          breakRequirements: '20 minutes per 6 hours',
          unionCompliance: true
        },
        tax: {
          vatRequired: true,
          invoiceRequirements: 'EU VAT Directive'
        },
        accessibility: {
          wcagLevel: 'AA',
          screenReaderSupport: true,
          keyboardNavigation: true
        }
      },
      implementationStatus: 'compliant',
      lastAudit: new Date()
    };

    // CCPA (California)
    const ccpaCompliance: RegionalCompliance = {
      region: 'CA-US',
      country: 'United States',
      requirements: {
        dataProtection: {
          regulation: 'CCPA',
          consentRequired: false, // Opt-out rather than opt-in
          dataRetentionDays: 365,
          rightToDelete: true,
          dataPortability: true
        },
        labor: {
          maxWorkingHours: 40,
          overtimeRegulations: 'California Labor Code',
          breakRequirements: '30 minutes per 5 hours',
          unionCompliance: true
        },
        tax: {
          vatRequired: false,
          invoiceRequirements: 'Standard US requirements'
        },
        accessibility: {
          wcagLevel: 'AA',
          screenReaderSupport: true,
          keyboardNavigation: true
        }
      },
      implementationStatus: 'compliant'
    };

    this.complianceRequirements.set('EU', gdprCompliance);
    this.complianceRequirements.set('CA-US', ccpaCompliance);
  }

  private localizeLocation(location: any, locale: string): any {
    // Localize location data based on regional preferences
    return {
      ...location,
      address: this.formatAddress(location.address, locale),
      timezone: this.getLocalizedTimezone(location.timezone, locale)
    };
  }

  private formatAddress(address: string, locale: string): string {
    // Format address according to local conventions
    // This would implement region-specific address formatting
    return address;
  }

  private getLocalizedTimezone(timezone: string, locale: string): string {
    // Return localized timezone name
    return timezone;
  }

  private isEULocale(locale: string): boolean {
    const euLocales = ['en-GB', 'fr-FR', 'de-DE', 'es-ES', 'it-IT', 'nl-NL', 'pl-PL'];
    return euLocales.includes(locale);
  }

  private hasExcessiveDataCollection(userdata: any): boolean {
    // Check if data collection is excessive
    // This would implement business logic to determine excessive collection
    return false;
  }

  private exceedsDataRetention(userdata: any): boolean {
    // Check if data retention period is exceeded
    if (!userdata.lastActivity) return false;
    
    const lastActivity = new Date(userdata.lastActivity);
    const retentionPeriod = 365 * 24 * 60 * 60 * 1000; // 1 year in milliseconds
    
    return Date.now() - lastActivity.getTime() > retentionPeriod;
  }

  private getRegionFromLocale(locale: string): string {
    if (this.isEULocale(locale)) return 'EU';
    if (locale.startsWith('en-US') || locale.startsWith('es-US')) return 'US';
    return 'GLOBAL';
  }

  private async loadLegalTemplate(
    templateType: string,
    locale: string
  ): Promise<string> {
    // Load legal document template for locale
    // This would fetch from database or file system
    return `Legal template for ${templateType} in ${locale}`;
  }

  private processLegalTemplate(
    template: string,
    compliance: RegionalCompliance,
    customizations?: Record<string, any>
  ): string {
    // Process template with compliance requirements and customizations
    return template
      .replace('{{DATA_RETENTION_DAYS}}', compliance.requirements.dataProtection.dataRetentionDays.toString())
      .replace('{{REGULATION}}', compliance.requirements.dataProtection.regulation);
  }

  private generateTranslationId(): string {
    return `trans_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}