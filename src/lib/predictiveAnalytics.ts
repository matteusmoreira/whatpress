import { supabase } from '@/lib/supabase'
import { AnalyticsService } from '@/lib/analytics'

export interface PredictionResult {
  prediction: number
  confidence: number
  trend: 'up' | 'down' | 'stable'
  factors: PredictionFactor[]
  recommendations: string[]
  historicalData: any[]
  forecastData: any[]
}

export interface PredictionFactor {
  name: string
  weight: number
  impact: 'positive' | 'negative' | 'neutral'
  description: string
}

export interface MLModel {
  id: string
  name: string
  type: 'regression' | 'classification' | 'time_series'
  accuracy: number
  lastTrained: Date
  features: string[]
  target: string
  status: 'active' | 'training' | 'error' | 'deprecated'
}

export interface TrainingData {
  features: number[][]
  targets: number[]
  metadata: Record<string, any>
}

export class PredictiveAnalyticsService {
  private analytics: AnalyticsService
  private models: Map<string, MLModel> = new Map()
  
  constructor(analytics: AnalyticsService) {
    this.analytics = analytics
    this.initializeModels()
  }

  private initializeModels() {
    // Modelos pré-definidos
    this.models.set('engagement_prediction', {
      id: 'engagement_prediction',
      name: 'Predição de Engajamento',
      type: 'regression',
      accuracy: 0.85,
      lastTrained: new Date(),
      features: ['open_rate', 'click_rate', 'time_of_day', 'day_of_week', 'segment_score'],
      target: 'engagement_score',
      status: 'active'
    })

    this.models.set('churn_prediction', {
      id: 'churn_prediction',
      name: 'Predição de Churn',
      type: 'classification',
      accuracy: 0.78,
      lastTrained: new Date(),
      features: ['last_activity', 'message_frequency', 'response_rate', 'subscription_age'],
      target: 'churn_probability',
      status: 'active'
    })

    this.models.set('conversion_prediction', {
      id: 'conversion_prediction',
      name: 'Predição de Conversão',
      type: 'regression',
      accuracy: 0.82,
      lastTrained: new Date(),
      features: ['campaign_type', 'audience_segment', 'message_personalization', 'timing_score'],
      target: 'conversion_rate',
      status: 'active'
    })

    this.models.set('optimal_send_time', {
      id: 'optimal_send_time',
      name: 'Horário Ótimo de Envio',
      type: 'time_series',
      accuracy: 0.79,
      lastTrained: new Date(),
      features: ['hour', 'day_of_week', 'audience_type', 'message_type'],
      target: 'open_probability',
      status: 'active'
    })
  }

  // Predição de engajamento para campanhas
  async predictEngagement(campaignData: any): Promise<PredictionResult> {
    try {
      // Coletar dados históricos
      const historicalData = await this.getHistoricalEngagementData(campaignData)
      
      // Calcular features
      const features = this.extractEngagementFeatures(campaignData, historicalData)
      
      // Aplicar modelo simples (média ponderada com tendência)
      const prediction = this.calculateEngagementPrediction(features, historicalData)
      
      // Analisar fatores
      const factors = this.analyzeEngagementFactors(features, historicalData)
      
      // Gerar recomendações
      const recommendations = this.generateEngagementRecommendations(factors, prediction)
      
      // Criar dados de previsão
      const forecastData = this.generateEngagementForecast(features, historicalData)
      
      return {
        prediction: prediction.score,
        confidence: prediction.confidence,
        trend: prediction.trend,
        factors,
        recommendations,
        historicalData,
        forecastData
      }
    } catch (error) {
      console.error('Erro na predição de engajamento:', error)
      throw error
    }
  }

  // Predição de churn (cancelamento)
  async predictChurn(userData: any): Promise<PredictionResult> {
    try {
      const historicalData = await this.getHistoricalUserData(userData.userId)
      
      const features = this.extractChurnFeatures(userData, historicalData)
      const prediction = this.calculateChurnPrediction(features, historicalData)
      const factors = this.analyzeChurnFactors(features, historicalData)
      const recommendations = this.generateChurnRecommendations(factors, prediction)
      const forecastData = this.generateChurnForecast(features, historicalData)
      
      return {
        prediction: prediction.score,
        confidence: prediction.confidence,
        trend: prediction.trend,
        factors,
        recommendations,
        historicalData,
        forecastData
      }
    } catch (error) {
      console.error('Erro na predição de churn:', error)
      throw error
    }
  }

  // Predição de conversão
  async predictConversion(campaignData: any): Promise<PredictionResult> {
    try {
      const historicalData = await this.getHistoricalConversionData(campaignData)
      
      const features = this.extractConversionFeatures(campaignData, historicalData)
      const prediction = this.calculateConversionPrediction(features, historicalData)
      const factors = this.analyzeConversionFactors(features, historicalData)
      const recommendations = this.generateConversionRecommendations(factors, prediction)
      const forecastData = this.generateConversionForecast(features, historicalData)
      
      return {
        prediction: prediction.score,
        confidence: prediction.confidence,
        trend: prediction.trend,
        factors,
        recommendations,
        historicalData,
        forecastData
      }
    } catch (error) {
      console.error('Erro na predição de conversão:', error)
      throw error
    }
  }

  // Encontrar horário ótimo de envio
  async findOptimalSendTime(audienceData: any): Promise<PredictionResult> {
    try {
      const historicalData = await this.getHistoricalSendTimeData(audienceData)
      
      const optimalTimes = this.calculateOptimalSendTimes(historicalData)
      const factors = this.analyzeSendTimeFactors(historicalData)
      const recommendations = this.generateSendTimeRecommendations(optimalTimes, factors)
      
      return {
        prediction: optimalTimes[0]?.score || 0,
        confidence: optimalTimes[0]?.confidence || 0.7,
        trend: 'stable',
        factors,
        recommendations,
        historicalData,
        forecastData: optimalTimes
      }
    } catch (error) {
      console.error('Erro ao encontrar horário ótimo:', error)
      throw error
    }
  }

  // Segmentação inteligente
  async intelligentSegmentation(users: any[]): Promise<any[]> {
    try {
      // Analisar características dos usuários
      const userFeatures = users.map(user => this.extractUserFeatures(user))
      
      // Aplicar clustering simples (k-means básico)
      const segments = this.performClustering(userFeatures)
      
      // Gerar insights para cada segmento
      const segmentInsights = segments.map(segment => ({
        ...segment,
        insights: this.generateSegmentInsights(segment.users),
        recommendations: this.generateSegmentRecommendations(segment)
      }))
      
      return segmentInsights
    } catch (error) {
      console.error('Erro na segmentação inteligente:', error)
      throw error
    }
  }

  // Análise de sentimento
  async analyzeSentiment(messages: string[]): Promise<any> {
    try {
      const results = messages.map(message => ({
        message,
        sentiment: this.calculateSentiment(message),
        confidence: this.calculateSentimentConfidence(message),
        keywords: this.extractKeywords(message)
      }))
      
      const overall = {
        positive: results.filter(r => r.sentiment === 'positive').length / results.length,
        negative: results.filter(r => r.sentiment === 'negative').length / results.length,
        neutral: results.filter(r => r.sentiment === 'neutral').length / results.length,
        averageConfidence: results.reduce((sum, r) => sum + r.confidence, 0) / results.length
      }
      
      return { results, overall, trends: this.analyzeSentimentTrends(results) }
    } catch (error) {
      console.error('Erro na análise de sentimento:', error)
      throw error
    }
  }

  // Métodos auxiliares privados
  
  private async getHistoricalEngagementData(campaignData: any): Promise<any[]> {
    // Buscar dados históricos de campanhas similares
    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .eq('type', campaignData.type)
      .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) throw error
    return data || []
  }

  private extractEngagementFeatures(campaignData: any, historicalData: any[]): number[] {
    // Extrair features numéricas para o modelo
    const features = [
      this.normalizeTime(campaignData.scheduledTime || new Date()),
      this.getDayOfWeek(campaignData.scheduledTime || new Date()),
      campaignData.audienceSize || 0,
      campaignData.personalizationScore || 0.5,
      this.calculateHistoricalAverage(historicalData, 'open_rate'),
      this.calculateHistoricalAverage(historicalData, 'click_rate'),
      this.calculateSegmentScore(campaignData.audience),
      this.calculateContentScore(campaignData.content)
    ]
    
    return features
  }

  private calculateEngagementPrediction(features: number[], historicalData: any[]): any {
    // Modelo simples: média ponderada com tendência
    const baseScore = this.calculateHistoricalAverage(historicalData, 'engagement_score') || 25
    const trend = this.calculateTrend(historicalData, 'engagement_score')
    
    // Ajustar baseado nas features
    const personalizationBoost = (features[3] - 0.5) * 10 // Personalização
    const timeAdjustment = this.getTimeImpact(features[0]) * 5 // Horário
    const segmentAdjustment = (features[6] - 0.5) * 8 // Segmentação
    
    const prediction = Math.max(0, Math.min(100, 
      baseScore + (trend * 5) + personalizationBoost + timeAdjustment + segmentAdjustment
    ))
    
    return {
      score: prediction,
      confidence: Math.min(0.9, 0.6 + (historicalData.length / 100) * 0.3),
      trend: trend > 0.1 ? 'up' : trend < -0.1 ? 'down' : 'stable'
    }
  }

  private analyzeEngagementFactors(features: number[], historicalData: any[]): PredictionFactor[] {
    return [
      {
        name: 'Personalização',
        weight: features[3],
        impact: features[3] > 0.7 ? 'positive' : features[3] < 0.3 ? 'negative' : 'neutral',
        description: 'Nível de personalização da mensagem'
      },
      {
        name: 'Horário de Envio',
        weight: Math.abs(this.getTimeImpact(features[0])),
        impact: this.getTimeImpact(features[0]) > 0 ? 'positive' : 'negative',
        description: 'Momento ideal para o público-alvo'
      },
      {
        name: 'Segmentação',
        weight: features[6],
        impact: features[6] > 0.6 ? 'positive' : features[6] < 0.4 ? 'negative' : 'neutral',
        description: 'Qualidade da segmentação do público'
      },
      {
        name: 'Tendência Histórica',
        weight: 0.8,
        impact: this.calculateTrend(historicalData, 'engagement_score') > 0 ? 'positive' : 'negative',
        description: 'Tendência recente de engajamento'
      }
    ]
  }

  private generateEngagementRecommendations(factors: PredictionFactor[], prediction: any): string[] {
    const recommendations: string[] = []
    
    // Recomendações baseadas nos fatores
    const personalizationFactor = factors.find(f => f.name === 'Personalização')
    if (personalizationFactor && personalizationFactor.weight < 0.5) {
      recommendations.push('Aumente a personalização da mensagem com campos dinâmicos')
    }
    
    const timeFactor = factors.find(f => f.name === 'Horário de Envio')
    if (timeFactor && timeFactor.impact === 'negative') {
      recommendations.push('Considere ajustar o horário de envio para melhor engajamento')
    }
    
    const segmentFactor = factors.find(f => f.name === 'Segmentação')
    if (segmentFactor && segmentFactor.weight < 0.6) {
      recommendations.push('Melhore a segmentação do público-alvo')
    }
    
    if (prediction.confidence < 0.7) {
      recommendations.push('Colete mais dados históricos para aumentar a precisão')
    }
    
    return recommendations
  }

  // Métodos auxiliares
  private normalizeTime(date: Date): number {
    return date.getHours() + date.getMinutes() / 60
  }

  private getDayOfWeek(date: Date): number {
    return date.getDay()
  }

  private calculateHistoricalAverage(data: any[], field: string): number {
    if (!data || data.length === 0) return 0
    const sum = data.reduce((acc, item) => acc + (item[field] || 0), 0)
    return sum / data.length
  }

  private calculateTrend(data: any[], field: string): number {
    if (!data || data.length < 2) return 0
    
    const recent = data.slice(-10).map(item => item[field] || 0)
    const older = data.slice(-20, -10).map(item => item[field] || 0)
    
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length
    
    return recentAvg - olderAvg
  }

  private calculateSegmentScore(audience: any): number {
    // Score baseado no tamanho e qualidade da segmentação
    if (!audience) return 0.5
    return Math.min(1, Math.max(0, (audience.filters?.length || 0) * 0.2))
  }

  private calculateContentScore(content: any): number {
    // Score baseado na qualidade do conteúdo
    if (!content) return 0.5
    let score = 0.5
    
    if (content.personalization) score += 0.2
    if (content.media) score += 0.1
    if (content.callToAction) score += 0.2
    
    return Math.min(1, score)
  }

  private getTimeImpact(hour: number): number {
    // Impacto do horário (9-17h é melhor)
    if (hour >= 9 && hour <= 17) return 0.2
    if (hour >= 18 && hour <= 22) return 0.1
    return -0.1
  }

  private generateEngagementForecast(features: number[], historicalData: any[]): any[] {
    // Gerar previsão para os próximos 7 dias
    const forecast = []
    const baseScore = this.calculateHistoricalAverage(historicalData, 'engagement_score') || 25
    
    for (let i = 1; i <= 7; i++) {
      const date = new Date()
      date.setDate(date.getDate() + i)
      
      forecast.push({
        date: date.toISOString().split('T')[0],
        predicted: baseScore + (Math.random() - 0.5) * 10,
        confidence: 0.7 + Math.random() * 0.2
      })
    }
    
    return forecast
  }

  // Métodos para outros tipos de predição (implementações similares)
  private async getHistoricalUserData(userId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('user_activities')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) throw error
    return data || []
  }

  private extractChurnFeatures(userData: any, historicalData: any[]): number[] {
    return [
      this.calculateDaysSinceLastActivity(historicalData),
      this.calculateMessageFrequency(historicalData),
      this.calculateResponseRate(historicalData),
      userData.subscriptionAge || 0,
      this.calculateEngagementTrend(historicalData)
    ]
  }

  private calculateChurnPrediction(features: number[], historicalData: any[]): any {
    const baseScore = 0.3 // Base churn rate
    const activityScore = Math.max(0, 1 - (features[0] / 30)) // Dias desde última atividade
    const frequencyScore = Math.min(1, features[1] / 10) // Frequência de mensagens
    const responseScore = features[2] // Taxa de resposta
    
    const prediction = Math.max(0, Math.min(1, 
      baseScore - (activityScore * 0.4) - (frequencyScore * 0.3) - (responseScore * 0.3)
    ))
    
    return {
      score: prediction,
      confidence: 0.75,
      trend: prediction > 0.5 ? 'up' : 'down'
    }
  }

  private calculateDaysSinceLastActivity(data: any[]): number {
    if (!data || data.length === 0) return 999
    const lastActivity = new Date(data[0].created_at)
    const now = new Date()
    return Math.floor((now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24))
  }

  private calculateMessageFrequency(data: any[]): number {
    if (!data || data.length === 0) return 0
    const last30Days = data.filter(item => {
      const date = new Date(item.created_at)
      const now = new Date()
      return (now.getTime() - date.getTime()) < (30 * 24 * 60 * 60 * 1000)
    })
    return last30Days.length
  }

  private calculateResponseRate(data: any[]): number {
    if (!data || data.length === 0) return 0
    const interactions = data.filter(item => item.type === 'response')
    return interactions.length / data.length
  }

  private calculateEngagementTrend(data: any[]): number {
    return this.calculateTrend(data, 'engagement_score')
  }

  // Métodos para análise de sentimento
  private calculateSentiment(text: string): 'positive' | 'negative' | 'neutral' {
    const positiveWords = ['bom', 'ótimo', 'excelente', 'adorei', 'perfeito', 'maravilhoso', 'incrível']
    const negativeWords = ['ruim', 'péssimo', 'horrível', 'odeio', 'terrível', 'frustrante']
    
    const lowerText = text.toLowerCase()
    const positiveCount = positiveWords.filter(word => lowerText.includes(word)).length
    const negativeCount = negativeWords.filter(word => lowerText.includes(word)).length
    
    if (positiveCount > negativeCount) return 'positive'
    if (negativeCount > positiveCount) return 'negative'
    return 'neutral'
  }

  private calculateSentimentConfidence(text: string): number {
    // Simulação de confiança baseada na quantidade de palavras-chave
    const words = text.split(' ').length
    return Math.min(1, 0.5 + (words / 20) * 0.3)
  }

  private extractKeywords(text: string): string[] {
    const stopWords = ['de', 'a', 'o', 'que', 'e', 'é', 'da', 'do', 'em', 'um', 'para']
    const words = text.toLowerCase().split(' ').filter(word => 
      word.length > 3 && !stopWords.includes(word)
    )
    return words.slice(0, 5)
  }

  private analyzeSentimentTrends(results: any[]): any {
    // Análise simples de tendências
    const recent = results.slice(-10)
    const positive = recent.filter(r => r.sentiment === 'positive').length
    const negative = recent.filter(r => r.sentiment === 'negative').length
    
    return {
      direction: positive > negative ? 'improving' : positive < negative ? 'declining' : 'stable',
      strength: Math.abs(positive - negative) / recent.length
    }
  }

  // Métodos para clustering e segmentação
  private performClustering(userFeatures: any[]): any[] {
    // Clustering simples baseado em similaridade
    const clusters = []
    const processed = new Set()
    
    userFeatures.forEach((user, index) => {
      if (processed.has(index)) return
      
      const cluster = {
        id: clusters.length + 1,
        users: [user],
        centroid: user.features,
        insights: {}
      }
      
      // Encontrar usuários similares
      userFeatures.forEach((otherUser, otherIndex) => {
        if (index === otherIndex || processed.has(otherIndex)) return
        
        const similarity = this.calculateSimilarity(user.features, otherUser.features)
        if (similarity > 0.7) { // Threshold de similaridade
          cluster.users.push(otherUser)
          processed.add(otherIndex)
        }
      })
      
      clusters.push(cluster)
      processed.add(index)
    })
    
    return clusters
  }

  private calculateSimilarity(features1: number[], features2: number[]): number {
    // Similaridade de cosseno simplificada
    const dotProduct = features1.reduce((sum, val, i) => sum + val * features2[i], 0)
    const magnitude1 = Math.sqrt(features1.reduce((sum, val) => sum + val * val, 0))
    const magnitude2 = Math.sqrt(features2.reduce((sum, val) => sum + val * val, 0))
    
    return magnitude1 && magnitude2 ? dotProduct / (magnitude1 * magnitude2) : 0
  }

  private extractUserFeatures(user: any): any {
    return {
      userId: user.id,
      features: [
        user.engagementScore || 0,
        user.messageFrequency || 0,
        user.lastActivityDays || 0,
        user.responseRate || 0,
        user.segmentScore || 0
      ]
    }
  }

  private generateSegmentInsights(users: any[]): any {
    return {
      averageEngagement: users.reduce((sum, u) => sum + (u.engagementScore || 0), 0) / users.length,
      averageFrequency: users.reduce((sum, u) => sum + (u.messageFrequency || 0), 0) / users.length,
      size: users.length,
      characteristics: this.identifySegmentCharacteristics(users)
    }
  }

  private identifySegmentCharacteristics(users: any[]): string[] {
    const characteristics = []
    
    const avgEngagement = users.reduce((sum, u) => sum + (u.engagementScore || 0), 0) / users.length
    if (avgEngagement > 70) characteristics.push('Alto engajamento')
    else if (avgEngagement < 30) characteristics.push('Baixo engajamento')
    
    const avgFrequency = users.reduce((sum, u) => sum + (u.messageFrequency || 0), 0) / users.length
    if (avgFrequency > 10) characteristics.push('Alta frequência')
    else if (avgFrequency < 3) characteristics.push('Baixa frequência')
    
    return characteristics
  }

  private generateSegmentRecommendations(segment: any): string[] {
    const recommendations = []
    
    if (segment.insights.averageEngagement > 70) {
      recommendations.push('Focar em retenção e fidelização')
      recommendations.push('Oferecer conteúdo exclusivo')
    } else if (segment.insights.averageEngagement < 30) {
      recommendations.push('Re-engajar com conteúdo relevante')
      recommendations.push('Oferecer incentivos')
    }
    
    if (segment.insights.averageFrequency < 3) {
      recommendations.push('Aumentar frequência de comunicação')
    }
    
    return recommendations
  }

  // Métodos para otimização de horários
  private async getHistoricalSendTimeData(audienceData: any): Promise<any[]> {
    const { data, error } = await supabase
      .from('message_analytics')
      .select('*')
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }

  private calculateOptimalSendTimes(historicalData: any[]): any[] {
    const hourlyStats = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      openRate: 0,
      clickRate: 0,
      totalMessages: 0,
      score: 0
    }))
    
    historicalData.forEach(item => {
      const hour = new Date(item.created_at).getHours()
      if (hourlyStats[hour]) {
        hourlyStats[hour].totalMessages += item.total_sent || 0
        hourlyStats[hour].openRate += item.open_rate || 0
        hourlyStats[hour].clickRate += item.click_rate || 0
      }
    })
    
    hourlyStats.forEach(stat => {
      if (stat.totalMessages > 0) {
        stat.openRate /= stat.totalMessages
        stat.clickRate /= stat.totalMessages
        stat.score = (stat.openRate * 0.6 + stat.clickRate * 0.4) * 100
      }
    })
    
    return hourlyStats
      .filter(stat => stat.totalMessages > 10) // Apenas horários com dados suficientes
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
  }

  private analyzeSendTimeFactors(historicalData: any[]): PredictionFactor[] {
    return [
      {
        name: 'Horário de Pico',
        weight: 0.4,
        impact: 'positive',
        description: 'Horários com maior taxa de abertura'
      },
      {
        name: 'Dia da Semana',
        weight: 0.3,
        impact: 'positive',
        description: 'Dias com melhor engajamento'
      },
      {
        name: 'Tipo de Audiência',
        weight: 0.3,
        impact: 'neutral',
        description: 'Preferências horárias do público'
      }
    ]
  }

  private generateSendTimeRecommendations(optimalTimes: any[], factors: PredictionFactor[]): string[] {
    const recommendations = []
    
    if (optimalTimes.length > 0) {
      const bestTime = optimalTimes[0]
      recommendations.push(`Horário ótimo: ${bestTime.hour}:00 (score: ${bestTime.score.toFixed(1)})`)
      
      if (optimalTimes.length > 1) {
        recommendations.push(`Alternativas: ${optimalTimes.slice(1, 3).map(t => `${t.hour}:00`).join(', ')}`)
      }
    }
    
    recommendations.push('Considere testar A/B com diferentes horários')
    recommendations.push('Monitore o desempenho e ajuste conforme necessário')
    
    return recommendations
  }

  // Métodos para dados históricos de conversão
  private async getHistoricalConversionData(campaignData: any): Promise<any[]> {
    const { data, error } = await supabase
      .from('conversion_analytics')
      .select('*')
      .eq('campaign_type', campaignData.type)
      .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) throw error
    return data || []
  }

  private extractConversionFeatures(campaignData: any, historicalData: any[]): number[] {
    return [
      this.getCampaignTypeScore(campaignData.type),
      this.calculateSegmentScore(campaignData.audience),
      campaignData.personalizationScore || 0.5,
      this.calculateHistoricalAverage(historicalData, 'conversion_rate'),
      this.calculateHistoricalAverage(historicalData, 'average_order_value')
    ]
  }

  private calculateConversionPrediction(features: number[], historicalData: any[]): any {
    const baseRate = this.calculateHistoricalAverage(historicalData, 'conversion_rate') || 0.02
    const typeMultiplier = features[0] // Multiplicador baseado no tipo
    const segmentMultiplier = features[1] // Multiplicador baseado na segmentação
    const personalizationMultiplier = 1 + (features[2] - 0.5) * 0.5 // Ajuste de personalização
    
    const prediction = Math.max(0, Math.min(1, 
      baseRate * typeMultiplier * segmentMultiplier * personalizationMultiplier
    ))
    
    return {
      score: prediction * 100, // Converter para porcentagem
      confidence: 0.8,
      trend: this.calculateTrend(historicalData, 'conversion_rate') > 0 ? 'up' : 'down'
    }
  }

  private analyzeConversionFactors(features: number[], historicalData: any[]): PredictionFactor[] {
    return [
      {
        name: 'Tipo de Campanha',
        weight: features[0],
        impact: 'positive',
        description: 'Eficácia do tipo de campanha escolhido'
      },
      {
        name: 'Segmentação',
        weight: features[1],
        impact: features[1] > 0.6 ? 'positive' : 'negative',
        description: 'Qualidade da segmentação do público'
      },
      {
        name: 'Personalização',
        weight: features[2],
        impact: features[2] > 0.7 ? 'positive' : 'neutral',
        description: 'Nível de personalização da oferta'
      }
    ]
  }

  private generateConversionRecommendations(factors: PredictionFactor[], prediction: any): string[] {
    const recommendations = []
    
    if (prediction.score < 5) {
      recommendations.push('Considere ajustar a oferta ou o público-alvo')
      recommendations.push('Teste diferentes tipos de campanhas')
    }
    
    const segmentFactor = factors.find(f => f.name === 'Segmentação')
    if (segmentFactor && segmentFactor.weight < 0.6) {
      recommendations.push('Melhore a segmentação para público mais qualificado')
    }
    
    recommendations.push('Use gatilhos de escassez ou urgência com moderação')
    recommendations.push('Otimize a página de destino para conversão')
    
    return recommendations
  }

  private generateConversionForecast(features: number[], historicalData: any[]): any[] {
    const forecast = []
    const baseRate = this.calculateHistoricalAverage(historicalData, 'conversion_rate') || 0.02
    
    for (let i = 1; i <= 7; i++) {
      const date = new Date()
      date.setDate(date.getDate() + i)
      
      forecast.push({
        date: date.toISOString().split('T')[0],
        predicted: baseRate * 100 + (Math.random() - 0.5) * 2,
        confidence: 0.7 + Math.random() * 0.2
      })
    }
    
    return forecast
  }

  private getCampaignTypeScore(type: string): number {
    const scores = {
      'promotional': 1.2,
      'newsletter': 0.8,
      'transactional': 1.5,
      'retargeting': 1.3,
      'welcome': 1.1,
      'abandoned_cart': 1.4
    }
    return scores[type as keyof typeof scores] || 1.0
  }

  // Métodos públicos para gerenciar modelos
  getModels(): MLModel[] {
    return Array.from(this.models.values())
  }

  getModel(id: string): MLModel | undefined {
    return this.models.get(id)
  }

  async trainModel(modelId: string, trainingData: TrainingData): Promise<void> {
    const model = this.models.get(modelId)
    if (!model) throw new Error('Modelo não encontrado')
    
    try {
      model.status = 'training'
      
      // Simular treinamento
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Atualizar precisão (mock)
      model.accuracy = 0.7 + Math.random() * 0.25
      model.lastTrained = new Date()
      model.status = 'active'
      
      // Salvar modelo treinado (mock)
      await supabase.from('ml_models').upsert({
        id: modelId,
        accuracy: model.accuracy,
        last_trained: model.lastTrained,
        status: model.status
      })
      
    } catch (error) {
      model.status = 'error'
      throw error
    }
  }

  async getModelPerformance(modelId: string, days: number = 30): Promise<any> {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    
    const { data, error } = await supabase
      .from('model_predictions')
      .select('*')
      .eq('model_id', modelId)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true })

    if (error) throw error
    
    return {
      predictions: data || [],
      accuracy: this.calculateModelAccuracy(data || []),
      trends: this.analyzePredictionTrends(data || [])
    }
  }

  private calculateModelAccuracy(predictions: any[]): number {
    if (!predictions || predictions.length === 0) return 0
    
    const correct = predictions.filter(p => 
      Math.abs(p.predicted_value - p.actual_value) < (p.predicted_value * 0.2)
    ).length
    
    return correct / predictions.length
  }

  private analyzePredictionTrends(predictions: any[]): any {
    if (!predictions || predictions.length < 2) return { direction: 'stable', strength: 0 }
    
    const recent = predictions.slice(-10)
    const accuracyTrend = this.calculateTrend(recent, 'accuracy')
    
    return {
      direction: accuracyTrend > 0.05 ? 'improving' : accuracyTrend < -0.05 ? 'declining' : 'stable',
      strength: Math.abs(accuracyTrend)
    }
  }
}

// Instância singleton
let predictiveService: PredictiveAnalyticsService | null = null

export function getPredictiveAnalyticsService(analytics: AnalyticsService): PredictiveAnalyticsService {
  if (!predictiveService) {
    predictiveService = new PredictiveAnalyticsService(analytics)
  }
  return predictiveService
}