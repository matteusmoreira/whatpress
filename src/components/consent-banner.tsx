import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Shield, Check, X } from 'lucide-react';
import { useConsent } from '@/hooks/useConsent';
import { useAuth } from '@/hooks/useAuth';
import { useSecurityAudit } from '@/services/securityAuditService';
import { cn } from '@/lib/utils';

interface ConsentBannerProps {
  className?: string;
  onConsentGiven?: () => void;
  onConsentDenied?: () => void;
}

export function ConsentBanner({ className, onConsentGiven, onConsentDenied }: ConsentBannerProps) {
  const { user } = useAuth();
  const { consentSettings, recordConsent } = useConsent();
  const { logEvent } = useSecurityAudit();
  const [showBanner, setShowBanner] = useState(false);
  const [loading, setLoading] = useState(false);
  const [consentOptions, setConsentOptions] = useState({
    messages: true,
    marketing: false,
    dataProcessing: true,
    thirdPartySharing: false
  });

  useEffect(() => {
    if (user && consentSettings?.show_consent_banner) {
      setShowBanner(true);
    }
  }, [user, consentSettings?.show_consent_banner]);

  const handleConsentGiven = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Registrar consentimentos
      const consentPromises = [];

      if (consentOptions.messages) {
        consentPromises.push(
          recordConsent(user.id, 'whatsapp_messages', true, 'website_form', 'Consentimento via banner LGPD')
        );
      }

      if (consentOptions.marketing) {
        consentPromises.push(
          recordConsent(user.id, 'marketing', true, 'website_form', 'Consentimento via banner LGPD')
        );
      }

      if (consentOptions.dataProcessing) {
        consentPromises.push(
          recordConsent(user.id, 'data_processing', true, 'website_form', 'Consentimento via banner LGPD')
        );
      }

      if (consentOptions.thirdPartySharing) {
        consentPromises.push(
          recordConsent(user.id, 'third_party_sharing', true, 'website_form', 'Consentimento via banner LGPD')
        );
      }

      await Promise.all(consentPromises);

      // Log de auditoria
      await logEvent({
        action: 'lgpd_consent_given',
        resource_type: 'user_consent',
        resource_id: user.id,
        status: 'success',
        metadata: consentOptions
      });

      setShowBanner(false);
      onConsentGiven?.();

    } catch (error) {
      console.error('Erro ao registrar consentimento:', error);
      
      await logEvent({
        action: 'lgpd_consent_error',
        resource_type: 'user_consent',
        resource_id: user.id,
        status: 'error',
        error_message: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConsentDenied = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Registrar negação de consentimento
      const consentPromises = [
        recordConsent(user.id, 'whatsapp_messages', false, 'website_form', 'Consentimento negado via banner LGPD'),
        recordConsent(user.id, 'marketing', false, 'website_form', 'Consentimento negado via banner LGPD'),
        recordConsent(user.id, 'data_processing', false, 'website_form', 'Consentimento negado via banner LGPD'),
        recordConsent(user.id, 'third_party_sharing', false, 'website_form', 'Consentimento negado via banner LGPD')
      ];

      await Promise.all(consentPromises);

      // Log de auditoria
      await logEvent({
        action: 'lgpd_consent_denied',
        resource_type: 'user_consent',
        resource_id: user.id,
        status: 'success'
      });

      setShowBanner(false);
      onConsentDenied?.();

    } catch (error) {
      console.error('Erro ao registrar negação de consentimento:', error);
      
      await logEvent({
        action: 'lgpd_consent_error',
        resource_type: 'user_consent',
        resource_id: user.id,
        status: 'error',
        error_message: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    } finally {
      setLoading(false);
    }
  };

  if (!showBanner || !consentSettings?.show_consent_banner) {
    return null;
  }

  return (
    <div className={cn("fixed bottom-4 right-4 z-50 w-full max-w-md", className)}>
      <Card className="shadow-2xl border-red-200 bg-gradient-to-br from-red-50 to-orange-50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-red-600" />
            <CardTitle className="text-red-800 text-lg">
              Sua Privacidade é Importante
            </CardTitle>
          </div>
          <CardDescription className="text-red-700">
            Respeitamos a LGPD e sua privacidade. Configure seus consentimentos abaixo:
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4 pb-4">
          {consentSettings?.require_consent_for_messages && (
            <div className="flex items-start space-x-3 space-y-0">
              <Checkbox
                id="messages"
                checked={consentOptions.messages}
                onCheckedChange={(checked) => 
                  setConsentOptions(prev => ({ ...prev, messages: checked as boolean }))
                }
                className="mt-1"
              />
              <div className="space-y-1 leading-none">
                <Label htmlFor="messages" className="text-sm font-medium text-gray-900">
                  Mensagens WhatsApp
                </Label>
                <p className="text-sm text-gray-600">
                  Permitir envio e recebimento de mensagens via WhatsApp
                </p>
              </div>
            </div>
          )}

          {consentSettings?.require_consent_for_marketing && (
            <div className="flex items-start space-x-3 space-y-0">
              <Checkbox
                id="marketing"
                checked={consentOptions.marketing}
                onCheckedChange={(checked) => 
                  setConsentOptions(prev => ({ ...prev, marketing: checked as boolean }))
                }
                className="mt-1"
              />
              <div className="space-y-1 leading-none">
                <Label htmlFor="marketing" className="text-sm font-medium text-gray-900">
                  Marketing e Promoções
                </Label>
                <p className="text-sm text-gray-600">
                  Receber mensagens de marketing, promoções e newsletters
                </p>
              </div>
            </div>
          )}

          <div className="flex items-start space-x-3 space-y-0">
            <Checkbox
              id="dataProcessing"
              checked={consentOptions.dataProcessing}
              onCheckedChange={(checked) => 
                setConsentOptions(prev => ({ ...prev, dataProcessing: checked as boolean }))
              }
              className="mt-1"
            />
            <div className="space-y-1 leading-none">
              <Label htmlFor="dataProcessing" className="text-sm font-medium text-gray-900">
                Processamento de Dados
              </Label>
              <p className="text-sm text-gray-600">
                Permitir o processamento necessário para funcionamento do serviço
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3 space-y-0">
            <Checkbox
              id="thirdPartySharing"
              checked={consentOptions.thirdPartySharing}
              onCheckedChange={(checked) => 
                setConsentOptions(prev => ({ ...prev, thirdPartySharing: checked as boolean }))
              }
              className="mt-1"
            />
            <div className="space-y-1 leading-none">
              <Label htmlFor="thirdPartySharing" className="text-sm font-medium text-gray-900">
                Compartilhamento com Terceiros
              </Label>
              <p className="text-sm text-gray-600">
                Compartilhar dados com parceiros para melhorar o serviço
              </p>
            </div>
          </div>
        </CardContent>
        
        <CardFooter className="flex gap-3 pt-3">
          <Button
            onClick={handleConsentGiven}
            disabled={loading}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
          >
            {loading ? (
              "Processando..."
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Aceitar
              </>
            )}
          </Button>
          
          <Button
            onClick={handleConsentDenied}
            disabled={loading}
            variant="outline"
            className="flex-1 border-red-300 text-red-700 hover:bg-red-50"
          >
            {loading ? (
              "Processando..."
            ) : (
              <>
                <X className="h-4 w-4 mr-2" />
                Recusar
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}