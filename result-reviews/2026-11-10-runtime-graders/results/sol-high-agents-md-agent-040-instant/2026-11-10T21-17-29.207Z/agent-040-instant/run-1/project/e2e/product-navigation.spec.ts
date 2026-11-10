import { expect, test } from '@playwright/test'
import { instant } from '@next/playwright'

test('shows the product title while live inventory loads from home', async ({ page }) => {
  await page.goto('http://localhost:3000')

  await instant(page, async () => {
    await page.getByRole('link', { name: 'View Product' }).click()
    await page.waitForURL('http://localhost:3000/product')

    await expect(page.getByRole('heading', { name: 'Premium Widget' })).toBeVisible()
    await expect(page.getByText('Loading inventory...')).toBeVisible()
    await expect(page.getByText(/^\d+ in stock$/)).toHaveCount(0)
  })

  await expect(page.getByText(/^\d+ in stock$/)).toBeVisible()
  await expect(page.getByText(/^Price: \$\d+\.\d{2}$/)).toBeVisible()
})
