import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent } from '../Card';
import { Button } from '../Button';
import { InputField, SelectField } from '../InputField';

interface KYCScreenProps {
  onBack: () => void;
  userId?: string;
  accessToken?: string;
  currentKYCLevel?: string;
  currentKYCStatus?: string;
}

interface KYCLevel1Data {
  nomeCompleto: string;
  cpf: string;
  dataNascimento: string;
  telefone: string;
  email: string;
  endereco: {
    cep: string;
    logradouro: string;
    numero: string;
    complemento: string;
    bairro: string;
    cidade: string;
    estado: string;
  };
}

interface KYCLevel2Data {
  documentType: string;
  documentImages: string[];
  selfieImage: string;
  comprovanteResidencia: string;
}

interface KYCLevel3Data {
  rendaMensal: string;
  fonteRenda: string;
  comprovanteRenda: string[];
  declaracaoFonteRecursos: string;
  patrimonioDeclarado: string;
  possuiEmpresa: boolean;
  dadosEmpresa?: {
    cnpj: string;
    razaoSocial: string;
    atividadePrincipal: string;
  };
}

type KYCLevel = 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3';

export const KYCScreen: React.FC<KYCScreenProps> = ({
  onBack,
  userId,
  accessToken,
  currentKYCLevel = 'NONE',
  currentKYCStatus = 'not_started'
}) => {
  const [activeLevel, setActiveLevel] = useState<KYCLevel>('LEVEL_1');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Form data states
  const [level1Data, setLevel1Data] = useState<KYCLevel1Data>({
    nomeCompleto: '',
    cpf: '',
    dataNascimento: '',
    telefone: '',
    email: '',
    endereco: {
      cep: '',
      logradouro: '',
      numero: '',
      complemento: '',
      bairro: '',
      cidade: '',
      estado: ''
    }
  });

  const [level2Data, setLevel2Data] = useState<KYCLevel2Data>({
    documentType: 'RG',
    documentImages: [],
    selfieImage: '',
    comprovanteResidencia: ''
  });

  const [level3Data, setLevel3Data] = useState<KYCLevel3Data>({
    rendaMensal: '',
    fonteRenda: 'salario',
    comprovanteRenda: [],
    declaracaoFonteRecursos: '',
    patrimonioDeclarado: '',
    possuiEmpresa: false,
    dadosEmpresa: undefined
  });

  // Determine which level should be active based on current status
  useEffect(() => {
    if (currentKYCLevel === 'NONE' || currentKYCStatus === 'rejected') {
      setActiveLevel('LEVEL_1');
    } else if (currentKYCLevel === 'LEVEL_1' && currentKYCStatus === 'verified') {
      setActiveLevel('LEVEL_2');
    } else if (currentKYCLevel === 'LEVEL_2' && currentKYCStatus === 'verified') {
      setActiveLevel('LEVEL_3');
    }
  }, [currentKYCLevel, currentKYCStatus]);

  const handleLevel1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/kyc/level1', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          ...level1Data,
          ipAddress: await getClientIP(),
          userAgent: navigator.userAgent
        }),
      });

      const result = await response.json();

      if (result.success) {
        setSuccess(result.message);
        if (result.status === 'verified') {
          setTimeout(() => {
            setActiveLevel('LEVEL_2');
            setSuccess(null);
          }, 2000);
        }
      } else {
        setError(result.error);
        if (result.validationErrors) {
          setError(`Erro de validação: ${result.validationErrors.join(', ')}`);
        }
      }
    } catch (err) {
      setError('Erro ao enviar dados. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleLevel2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/kyc/level2', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          ...level2Data,
          ipAddress: await getClientIP(),
          userAgent: navigator.userAgent
        }),
      });

      const result = await response.json();

      if (result.success) {
        setSuccess(`${result.message}. Estimativa: ${result.estimatedProcessingTime}`);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Erro ao enviar documentos. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleLevel3Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/kyc/level3', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          ...level3Data,
          ipAddress: await getClientIP(),
          userAgent: navigator.userAgent
        }),
      });

      const result = await response.json();

      if (result.success) {
        setSuccess(`${result.message}. Estimativa: ${result.estimatedProcessingTime}`);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Erro ao enviar dados financeiros. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (file: File, type: string) => {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>, imageType: 'document' | 'selfie' | 'comprovante') => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      const file = files[0];
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('Arquivo muito grande. Máximo 5MB.');
        return;
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Apenas imagens são aceitas.');
        return;
      }

      const base64 = await handleFileUpload(file, imageType);

      if (imageType === 'document') {
        setLevel2Data(prev => ({
          ...prev,
          documentImages: [...prev.documentImages, base64]
        }));
      } else if (imageType === 'selfie') {
        setLevel2Data(prev => ({
          ...prev,
          selfieImage: base64
        }));
      } else if (imageType === 'comprovante') {
        setLevel2Data(prev => ({
          ...prev,
          comprovanteResidencia: base64
        }));
      }

      setError(null);
    } catch (err) {
      setError('Erro ao processar imagem. Tente novamente.');
    }
  };

  const formatCPF = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    return numbers.replace(/(\d{2})(\d{4,5})(\d{4})/, '($1) $2-$3');
  };

  const formatCEP = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    return numbers.replace(/(\d{5})(\d{3})/, '$1-$2');
  };

  const getClientIP = async (): Promise<string> => {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch {
      return '0.0.0.0';
    }
  };

  const renderKYCLevels = () => {
    const levels = [
      {
        level: 'LEVEL_1',
        name: 'Nível 1',
        description: 'Dados pessoais básicos',
        limits: 'Até R$ 2.500/dia',
        time: '5-10 min',
        status: currentKYCLevel === 'LEVEL_1' ? currentKYCStatus : 
                currentKYCLevel === 'LEVEL_2' || currentKYCLevel === 'LEVEL_3' ? 'verified' : 'not_started'
      },
      {
        level: 'LEVEL_2',
        name: 'Nível 2', 
        description: 'Documentos + biometria',
        limits: 'Até R$ 25.000/dia',
        time: '10-30 min',
        status: currentKYCLevel === 'LEVEL_2' ? currentKYCStatus :
                currentKYCLevel === 'LEVEL_3' ? 'verified' : 'not_started'
      },
      {
        level: 'LEVEL_3',
        name: 'Nível 3',
        description: 'Renda + fonte recursos',
        limits: 'Até R$ 100.000/dia',
        time: '1-3 dias',
        status: currentKYCLevel === 'LEVEL_3' ? currentKYCStatus : 'not_started'
      }
    ];

    return (
      <div className="space-y-4 mb-6">
        {levels.map((level) => {
          const isActive = level.level === activeLevel;
          const isCompleted = level.status === 'verified';
          const isPending = level.status === 'pending' || level.status === 'under_review';
          const isRejected = level.status === 'rejected';

          return (
            <div
              key={level.level}
              className={`p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                isActive ? 'border-amber-500 bg-amber-50' :
                isCompleted ? 'border-green-500 bg-green-50' :
                isPending ? 'border-yellow-500 bg-yellow-50' :
                isRejected ? 'border-red-500 bg-red-50' :
                'border-gray-200 bg-gray-50'
              }`}
              onClick={() => {
                if (level.level === 'LEVEL_1' || 
                    (level.level === 'LEVEL_2' && currentKYCLevel !== 'NONE') ||
                    (level.level === 'LEVEL_3' && currentKYCLevel === 'LEVEL_2' && currentKYCStatus === 'verified')) {
                  setActiveLevel(level.level as KYCLevel);
                }
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    isCompleted ? 'bg-green-500' :
                    isPending ? 'bg-yellow-500' :
                    isRejected ? 'bg-red-500' :
                    isActive ? 'bg-amber-500' : 'bg-gray-300'
                  }`}>
                    {isCompleted ? (
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : isPending ? (
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    ) : isRejected ? (
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    ) : (
                      <span className="text-white text-sm font-bold">{level.level.split('_')[1]}</span>
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800">{level.name}</h3>
                    <p className="text-sm text-slate-600">{level.description}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-green-600">{level.limits}</p>
                  <p className="text-xs text-slate-500">{level.time}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderLevel1Form = () => (
    <form onSubmit={handleLevel1Submit} className="space-y-4">
      <InputField
        label="Nome Completo"
        value={level1Data.nomeCompleto}
        onChange={(e) => setLevel1Data(prev => ({ ...prev, nomeCompleto: e.target.value }))}
        placeholder="Seu nome completo"
        required
      />

      <InputField
        label="CPF"
        value={level1Data.cpf}
        onChange={(e) => setLevel1Data(prev => ({ ...prev, cpf: formatCPF(e.target.value) }))}
        placeholder="000.000.000-00"
        maxLength={14}
        required
      />

      <InputField
        label="Data de Nascimento"
        type="date"
        value={level1Data.dataNascimento}
        onChange={(e) => setLevel1Data(prev => ({ ...prev, dataNascimento: e.target.value }))}
        required
      />

      <InputField
        label="Telefone"
        value={level1Data.telefone}
        onChange={(e) => setLevel1Data(prev => ({ ...prev, telefone: formatPhone(e.target.value) }))}
        placeholder="(11) 99999-9999"
        maxLength={15}
        required
      />

      <InputField
        label="Email"
        type="email"
        value={level1Data.email}
        onChange={(e) => setLevel1Data(prev => ({ ...prev, email: e.target.value }))}
        placeholder="seu@email.com"
        required
      />

      <div className="bg-slate-50 rounded-2xl p-4 space-y-4">
        <h4 className="font-semibold text-slate-800">Endereço</h4>
        
        <InputField
          label="CEP"
          value={level1Data.endereco.cep}
          onChange={(e) => setLevel1Data(prev => ({ 
            ...prev, 
            endereco: { ...prev.endereco, cep: formatCEP(e.target.value) }
          }))}
          placeholder="00000-000"
          maxLength={9}
          required
        />

        <InputField
          label="Logradouro"
          value={level1Data.endereco.logradouro}
          onChange={(e) => setLevel1Data(prev => ({ 
            ...prev, 
            endereco: { ...prev.endereco, logradouro: e.target.value }
          }))}
          placeholder="Rua, Avenida, etc."
          required
        />

        <div className="grid grid-cols-2 gap-4">
          <InputField
            label="Número"
            value={level1Data.endereco.numero}
            onChange={(e) => setLevel1Data(prev => ({ 
              ...prev, 
              endereco: { ...prev.endereco, numero: e.target.value }
            }))}
            placeholder="123"
            required
          />

          <InputField
            label="Complemento"
            value={level1Data.endereco.complemento}
            onChange={(e) => setLevel1Data(prev => ({ 
              ...prev, 
              endereco: { ...prev.endereco, complemento: e.target.value }
            }))}
            placeholder="Apt 45"
          />
        </div>

        <InputField
          label="Bairro"
          value={level1Data.endereco.bairro}
          onChange={(e) => setLevel1Data(prev => ({ 
            ...prev, 
            endereco: { ...prev.endereco, bairro: e.target.value }
          }))}
          placeholder="Centro"
          required
        />

        <div className="grid grid-cols-2 gap-4">
          <InputField
            label="Cidade"
            value={level1Data.endereco.cidade}
            onChange={(e) => setLevel1Data(prev => ({ 
              ...prev, 
              endereco: { ...prev.endereco, cidade: e.target.value }
            }))}
            placeholder="São Paulo"
            required
          />

          <SelectField
            label="Estado"
            value={level1Data.endereco.estado}
            onChange={(e) => setLevel1Data(prev => ({ 
              ...prev, 
              endereco: { ...prev.endereco, estado: e.target.value }
            }))}
            options={[
              { value: '', label: 'Selecione' },
              { value: 'SP', label: 'São Paulo' },
              { value: 'RJ', label: 'Rio de Janeiro' },
              { value: 'MG', label: 'Minas Gerais' },
              { value: 'RS', label: 'Rio Grande do Sul' },
              { value: 'PR', label: 'Paraná' },
              { value: 'SC', label: 'Santa Catarina' },
              { value: 'BA', label: 'Bahia' },
              { value: 'GO', label: 'Goiás' },
              { value: 'ES', label: 'Espírito Santo' },
              { value: 'DF', label: 'Distrito Federal' }
            ]}
            required
          />
        </div>
      </div>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        className="w-full"
        disabled={loading}
      >
        {loading ? 'Verificando...' : 'Enviar Dados Básicos'}
      </Button>
    </form>
  );

  const renderLevel2Form = () => (
    <form onSubmit={handleLevel2Submit} className="space-y-6">
      <div className="bg-blue-50 rounded-2xl p-4 border border-blue-200">
        <div className="flex items-start gap-3">
          <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h4 className="font-semibold text-blue-800 mb-1">Documentos Necessários</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Documento oficial com foto (RG, CNH ou Passaporte)</li>
              <li>• Selfie segurando o documento</li>
              <li>• Comprovante de residência atualizado</li>
            </ul>
          </div>
        </div>
      </div>

      <SelectField
        label="Tipo de Documento"
        value={level2Data.documentType}
        onChange={(e) => setLevel2Data(prev => ({ ...prev, documentType: e.target.value }))}
        options={[
          { value: 'RG', label: 'RG - Registro Geral' },
          { value: 'CNH', label: 'CNH - Carteira de Habilitação' },
          { value: 'PASSPORT', label: 'Passaporte' }
        ]}
        required
      />

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700">Foto do Documento</label>
        <div className="border-2 border-dashed border-gray-300 rounded-2xl p-6 text-center">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => handleDocumentUpload(e, 'document')}
            className="hidden"
            id="document-upload"
          />
          <label htmlFor="document-upload" className="cursor-pointer">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <p className="text-sm text-gray-600">Clique para adicionar foto do documento</p>
            <p className="text-xs text-gray-500 mt-1">PNG, JPG até 5MB</p>
          </label>
          {level2Data.documentImages.length > 0 && (
            <p className="text-sm text-green-600 mt-2">
              ✓ {level2Data.documentImages.length} imagem(ns) adicionada(s)
            </p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700">Selfie com Documento</label>
        <div className="border-2 border-dashed border-gray-300 rounded-2xl p-6 text-center">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => handleDocumentUpload(e, 'selfie')}
            className="hidden"
            id="selfie-upload"
          />
          <label htmlFor="selfie-upload" className="cursor-pointer">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <p className="text-sm text-gray-600">Clique para tirar selfie com documento</p>
            <p className="text-xs text-gray-500 mt-1">Segure o documento próximo ao rosto</p>
          </label>
          {level2Data.selfieImage && (
            <p className="text-sm text-green-600 mt-2">✓ Selfie adicionada</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700">Comprovante de Residência</label>
        <div className="border-2 border-dashed border-gray-300 rounded-2xl p-6 text-center">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => handleDocumentUpload(e, 'comprovante')}
            className="hidden"
            id="comprovante-upload"
          />
          <label htmlFor="comprovante-upload" className="cursor-pointer">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-sm text-gray-600">Clique para adicionar comprovante</p>
            <p className="text-xs text-gray-500 mt-1">Conta de luz, água, telefone (últimos 3 meses)</p>
          </label>
          {level2Data.comprovanteResidencia && (
            <p className="text-sm text-green-600 mt-2">✓ Comprovante adicionado</p>
          )}
        </div>
      </div>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        className="w-full"
        disabled={loading || !level2Data.documentImages.length || !level2Data.selfieImage}
      >
        {loading ? 'Enviando Documentos...' : 'Enviar Documentos'}
      </Button>
    </form>
  );

  const renderLevel3Form = () => (
    <form onSubmit={handleLevel3Submit} className="space-y-6">
      <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200">
        <div className="flex items-start gap-3">
          <div className="w-6 h-6 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
            </svg>
          </div>
          <div>
            <h4 className="font-semibold text-amber-800 mb-1">Verificação Financeira</h4>
            <p className="text-sm text-amber-700">
              Para transações de alto valor, precisamos verificar sua capacidade financeira e fonte de recursos.
            </p>
          </div>
        </div>
      </div>

      <InputField
        label="Renda Mensal (R$)"
        type="number"
        value={level3Data.rendaMensal}
        onChange={(e) => setLevel3Data(prev => ({ ...prev, rendaMensal: e.target.value }))}
        placeholder="5000.00"
        min="0"
        step="0.01"
        required
      />

      <SelectField
        label="Fonte de Renda Principal"
        value={level3Data.fonteRenda}
        onChange={(e) => setLevel3Data(prev => ({ ...prev, fonteRenda: e.target.value }))}
        options={[
          { value: 'salario', label: 'Salário (CLT)' },
          { value: 'autonomo', label: 'Trabalho Autônomo' },
          { value: 'empresario', label: 'Empresário' },
          { value: 'investimentos', label: 'Investimentos' },
          { value: 'aposentadoria', label: 'Aposentadoria' },
          { value: 'outros', label: 'Outros' }
        ]}
        required
      />

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700">Declaração de Fonte de Recursos</label>
        <textarea
          value={level3Data.declaracaoFonteRecursos}
          onChange={(e) => setLevel3Data(prev => ({ ...prev, declaracaoFonteRecursos: e.target.value }))}
          placeholder="Descreva detalhadamente a origem dos recursos que pretende movimentar na plataforma..."
          className="w-full px-4 py-3 bg-white rounded-2xl border border-green-200 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-200"
          rows={4}
          required
        />
      </div>

      <InputField
        label="Patrimônio Declarado (R$) - Opcional"
        type="number"
        value={level3Data.patrimonioDeclarado}
        onChange={(e) => setLevel3Data(prev => ({ ...prev, patrimonioDeclarado: e.target.value }))}
        placeholder="100000.00"
        min="0"
        step="0.01"
      />

      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="possui-empresa"
            checked={level3Data.possuiEmpresa}
            onChange={(e) => setLevel3Data(prev => ({ ...prev, possuiEmpresa: e.target.checked }))}
            className="w-5 h-5 text-amber-600 bg-gray-100 border-gray-300 rounded focus:ring-amber-500 focus:ring-2"
          />
          <label htmlFor="possui-empresa" className="text-sm font-medium text-slate-700">
            Possuo empresa
          </label>
        </div>

        {level3Data.possuiEmpresa && (
          <div className="bg-slate-50 rounded-2xl p-4 space-y-4">
            <h4 className="font-semibold text-slate-800">Dados da Empresa</h4>
            
            <InputField
              label="CNPJ"
              value={level3Data.dadosEmpresa?.cnpj || ''}
              onChange={(e) => setLevel3Data(prev => ({ 
                ...prev, 
                dadosEmpresa: { 
                  ...prev.dadosEmpresa,
                  cnpj: e.target.value.replace(/\D/g, '').replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5'),
                  razaoSocial: prev.dadosEmpresa?.razaoSocial || '',
                  atividadePrincipal: prev.dadosEmpresa?.atividadePrincipal || ''
                }
              }))}
              placeholder="00.000.000/0001-00"
              maxLength={18}
            />

            <InputField
              label="Razão Social"
              value={level3Data.dadosEmpresa?.razaoSocial || ''}
              onChange={(e) => setLevel3Data(prev => ({ 
                ...prev, 
                dadosEmpresa: { 
                  ...prev.dadosEmpresa,
                  cnpj: prev.dadosEmpresa?.cnpj || '',
                  razaoSocial: e.target.value,
                  atividadePrincipal: prev.dadosEmpresa?.atividadePrincipal || ''
                }
              }))}
              placeholder="Nome da empresa"
            />

            <InputField
              label="Atividade Principal"
              value={level3Data.dadosEmpresa?.atividadePrincipal || ''}
              onChange={(e) => setLevel3Data(prev => ({ 
                ...prev, 
                dadosEmpresa: { 
                  ...prev.dadosEmpresa,
                  cnpj: prev.dadosEmpresa?.cnpj || '',
                  razaoSocial: prev.dadosEmpresa?.razaoSocial || '',
                  atividadePrincipal: e.target.value
                }
              }))}
              placeholder="Descrição da atividade"
            />
          </div>
        )}
      </div>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        className="w-full"
        disabled={loading}
      >
        {loading ? 'Enviando Dados Financeiros...' : 'Enviar Verificação Financeira'}
      </Button>
    </form>
  );

  return (
    <Card variant="elevated" className="max-w-2xl mx-auto">
      <CardHeader showBackButton onBackClick={onBack}>
        Verificação de Identidade (KYC)
      </CardHeader>

      <CardContent>
        {/* KYC Levels Overview */}
        {renderKYCLevels()}

        {/* Status Messages */}
        {error && (
          <div className="bg-red-50 rounded-2xl p-4 border border-red-200 mb-6">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="bg-green-50 rounded-2xl p-4 border border-green-200 mb-6">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm text-green-800">{success}</p>
            </div>
          </div>
        )}

        {/* Active Form */}
        <div className="bg-white rounded-2xl p-6 border border-green-100">
          {activeLevel === 'LEVEL_1' && renderLevel1Form()}
          {activeLevel === 'LEVEL_2' && renderLevel2Form()}
          {activeLevel === 'LEVEL_3' && renderLevel3Form()}
        </div>

        {/* Legal Notice */}
        <div className="mt-6 p-4 bg-slate-50 rounded-2xl border border-slate-200">
          <p className="text-xs text-slate-600 text-center">
            Seus dados são protegidos pela LGPD e utilizados apenas para verificação de identidade e compliance regulatório. 
            O Capy Pay não compartilha suas informações pessoais com terceiros sem seu consentimento.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}; 