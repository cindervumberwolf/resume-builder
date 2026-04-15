"""Playwright-based Google search with anti-detection measures."""
from __future__ import annotations

import asyncio
import random
import logging
from urllib.parse import quote_plus

from playwright.async_api import async_playwright, Page, BrowserContext

logger = logging.getLogger("data_acq.discovery")

GOOGLE_URL = "https://www.google.com/search?q={query}&num=20&hl=en"


async def _random_delay(min_sec: float = 5, max_sec: float = 15) -> None:
    delay = random.uniform(min_sec, max_sec)
    logger.debug("Waiting %.1f seconds...", delay)
    await asyncio.sleep(delay)


async def _extract_result_urls(page: Page) -> list[str]:
    """Extract organic search result URLs from a Google SERP."""
    urls: list[str] = []
    links = await page.query_selector_all("div#search a[href]")
    for link in links:
        href = await link.get_attribute("href")
        if not href:
            continue
        if href.startswith("http") and "google.com" not in href:
            urls.append(href)
    return urls


async def _check_captcha(page: Page) -> bool:
    content = await page.content()
    captcha_signals = ["recaptcha", "unusual traffic", "not a robot", "captcha"]
    return any(s in content.lower() for s in captcha_signals)


async def search_google(
    queries: list[str],
    delay_min: float = 5,
    delay_max: float = 15,
    max_queries: int = 25,
) -> dict[str, list[str]]:
    """Run multiple Google searches and return {query: [urls]}.
    
    Stops early if CAPTCHA is detected.
    """
    results: dict[str, list[str]] = {}
    queries = queries[:max_queries]

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=False,
            args=["--disable-blink-features=AutomationControlled"],
        )
        context = await browser.new_context(
            viewport={"width": 1280, "height": 800},
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/131.0.0.0 Safari/537.36"
            ),
        )
        page = await context.new_page()

        for i, query in enumerate(queries):
            logger.info("Search [%d/%d]: %s", i + 1, len(queries), query)

            url = GOOGLE_URL.format(query=quote_plus(query))
            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=30000)
                await page.wait_for_timeout(2000)

                if await _check_captcha(page):
                    logger.warning("CAPTCHA detected! Pausing. Completed %d/%d queries.", i, len(queries))
                    logger.warning("Please solve the CAPTCHA in the browser window, then the script will continue.")
                    for _ in range(120):
                        await asyncio.sleep(2)
                        if not await _check_captcha(page):
                            logger.info("CAPTCHA resolved, continuing...")
                            break
                    else:
                        logger.error("CAPTCHA not resolved after 4 minutes. Stopping search.")
                        break

                urls = await _extract_result_urls(page)
                results[query] = urls
                logger.info("  Found %d results", len(urls))

            except Exception as e:
                logger.error("  Search failed: %s", e)
                results[query] = []

            if i < len(queries) - 1:
                await _random_delay(delay_min, delay_max)

        await browser.close()

    return results
