import { test, expect } from '@playwright/test'

// Cenário 1: fluxo de sucesso
test('Envio de mídia com preview e loading', async ({ page }) => {
  await page.goto('http://localhost:8000/dev/media')

  // Abre modal
  const openBtn = page.getByTestId('open-media-upload')
  await expect(openBtn).toBeVisible()
  await openBtn.click()
  await expect(page.getByTestId('media-dialog')).toBeVisible()
  await expect(page.getByTestId('media-file-input')).toBeVisible()

  // Seleciona arquivo pequeno (<1MB)
  const fileInput = page.getByTestId('media-file-input')
  await expect(fileInput).toBeVisible()
  const smallBuffer = Buffer.alloc(100 * 1024, 1) // 100KB
  await fileInput.setInputFiles({ name: 'foto-teste.jpg', mimeType: 'image/jpeg', buffer: smallBuffer })

  // Verifica preview
  await expect(page.getByTestId('media-file-input')).toBeVisible()
  await expect(page.locator('img[alt="Preview"]')).toBeVisible()

  // Adiciona legenda
  await page.getByPlaceholder('Legenda (opcional)').fill('Legenda de teste')

  // Envia e verifica estado de loading/disabled
  const sendBtn = page.getByTestId('send-media')
  await expect(sendBtn).toBeVisible()
  await sendBtn.click()
  // Deve ficar desabilitado durante o envio
  await expect(sendBtn).toBeDisabled()
  // Feedback de envio em andamento
  await expect(page.getByText('Enviando...', { exact: false })).toBeVisible()
})

// Cenário 2: erro por tamanho
test('Erro ao selecionar arquivo maior que 16MB', async ({ page }) => {
  await page.goto('http://localhost:8000/dev/media')

  // Abre modal
  const openBtn2 = page.getByTestId('open-media-upload')
  await expect(openBtn2).toBeVisible()
  await openBtn2.click()
  await expect(page.getByTestId('media-dialog')).toBeVisible()
  await expect(page.getByTestId('media-file-input')).toBeVisible()

  // Tenta selecionar arquivo grande (>16MB)
  const fileInput2 = page.getByTestId('media-file-input')
  await expect(fileInput2).toBeVisible()
  const bigBuffer = Buffer.alloc((16 * 1024 * 1024) + 1, 1) // 16MB + 1 byte
  await fileInput2.setInputFiles({ name: 'grande.pdf', mimeType: 'application/pdf', buffer: bigBuffer })

  // Verifica mensagem de erro
  await expect(page.getByText('Arquivo excede 16MB', { exact: false })).toBeVisible()
})