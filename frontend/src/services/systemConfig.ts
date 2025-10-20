import axios from 'axios'
import { config } from '@/config/config'

export interface SystemStatus {
  database: { connected: boolean; type: string; url: string }
  redis: { connected: boolean; url: string }
  qdrant: { connected: boolean; url: string }
  apis: {
    google: { configured: boolean; clientId: string }
    openweather: { configured: boolean; key: string }
    googleMaps: { configured: boolean; key: string }
    openai: { configured: boolean; key: string }
  }
  services: {
    codenet: { enabled: boolean; datasetPath: string; maxExamples: number }
    enhanced: any
  }
}

export interface ConnectionTestResults {
  [key: string]: { connected: boolean; latency?: string; error?: string }
}

export interface MailParsingConfig {
  gmailIntegration: {
    enabled: boolean
    scopes: string[]
    autoProcessing: boolean
  }
  emailProcessing: {
    autoDetectSchedules: boolean
    parseAttachments: boolean
    extractContacts: boolean
    extractEquipment: boolean
    extractSafetyNotes: boolean
  }
  parsingRules: {
    subjectPatterns: string[]
    senderPatterns: string[]
    attachmentTypes: string[]
  }
  processingSettings: {
    maxFileSize: string
    supportedFormats: string[]
    ocrEnabled: boolean
    aiClassification: boolean
  }
}

export interface LLMConfig {
  openaiApiKey?: string
  codenet?: {
    enableRAG: boolean
    maxExamples: number
    datasetPath: string
  }
  enhancedServices?: {
    enableEnhancedPDF: boolean
    enableEnhancedEmail: boolean
    enableEnhancedRouting: boolean
    enableEnhancedCalendar: boolean
    enableAIClassification: boolean
  }
}

class SystemConfigService {
  private baseURL = `${config.apiBaseUrl}/api/config`

  async getSystemStatus(): Promise<{ success: boolean; status: SystemStatus; timestamp: string }> {
    try {
      const response = await axios.get(`${this.baseURL}/status`, {
        headers: {
          Authorization: `Bearer ${this.getAuthToken()}`,
        },
      })
      return response.data
    } catch (error) {
      console.error('Failed to get system status:', error)
      throw error
    }
  }

  async testConnections(): Promise<{ success: boolean; results: ConnectionTestResults; timestamp: string }> {
    try {
      const response = await axios.post(`${this.baseURL}/test-connections`, {}, {
        headers: {
          Authorization: `Bearer ${this.getAuthToken()}`,
        },
      })
      return response.data
    } catch (error) {
      console.error('Failed to test connections:', error)
      throw error
    }
  }

  async getMailParsingConfig(): Promise<{ success: boolean; config: MailParsingConfig }> {
    try {
      const response = await axios.get(`${this.baseURL}/mail-parsing`, {
        headers: {
          Authorization: `Bearer ${this.getAuthToken()}`,
        },
      })
      return response.data
    } catch (error) {
      console.error('Failed to get mail parsing config:', error)
      throw error
    }
  }

  async updateMailParsingConfig(config: Partial<MailParsingConfig>): Promise<{ success: boolean; config: MailParsingConfig; message: string }> {
    try {
      const response = await axios.put(`${this.baseURL}/mail-parsing`, config, {
        headers: {
          Authorization: `Bearer ${this.getAuthToken()}`,
        },
      })
      return response.data
    } catch (error) {
      console.error('Failed to update mail parsing config:', error)
      throw error
    }
  }

  async getLLMConfig(): Promise<{ success: boolean; config: LLMConfig }> {
    try {
      const response = await axios.get(`${this.baseURL}/llm`, {
        headers: {
          Authorization: `Bearer ${this.getAuthToken()}`,
        },
      })
      return response.data
    } catch (error) {
      console.error('Failed to get LLM config:', error)
      throw error
    }
  }

  async updateLLMConfig(config: Partial<LLMConfig>): Promise<{ success: boolean; config: LLMConfig; message: string }> {
    try {
      const response = await axios.put(`${this.baseURL}/llm`, config, {
        headers: {
          Authorization: `Bearer ${this.getAuthToken()}`,
        },
      })
      return response.data
    } catch (error) {
      console.error('Failed to update LLM config:', error)
      throw error
    }
  }

  private getAuthToken(): string {
    // This should get the token from your auth store
    return localStorage.getItem('auth-storage') ? JSON.parse(localStorage.getItem('auth-storage')!).state.token : ''
  }
}

export const systemConfigService = new SystemConfigService()