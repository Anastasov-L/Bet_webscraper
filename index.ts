import puppeteerExtra from 'puppeteer-extra';
import puppeteer, { Page } from 'puppeteer';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
puppeteerExtra.use(StealthPlugin());

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

(async () => {
  const browser = await puppeteerExtra.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--start-fullscreen'],
    defaultViewport: null
  });

  const page: Page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
  );

  await page.goto('https://www.hollandcasino.nl/sportsbook', {
    waitUntil: 'networkidle2',
    timeout: 0
  });

  await sleep(12218);
  try {
    await page.waitForSelector('.ta-FlexPane.ta-TopSportsView');
  } catch {
    console.log(' TopSportsView not found');
    await browser.close();
    return;
  }

  await sleep(2836);

  const selectedSport = await page.evaluate(() => {
    const topSection = document.querySelector('.ta-FlexPane.ta-TopSportsView');
    if (!topSection) return { chosen: 'none', index: -1 };

    const sportButtons = Array.from(topSection.querySelectorAll('.ta-Button.ta-MenuRowItem'));

    const parsed: { name: string; count: number; elIndex: number }[] = [];

    sportButtons.forEach((btn, idx) => {
      const itemText = btn.querySelector('.ta-ItemText');
      const rawLabel = itemText?.textContent?.trim() || '';
      const match = rawLabel.match(/^(.+?)\s*\((\d+)\)$/);
      if (match) {
        const name = match[1].trim();
        const count = parseInt(match[2], 10);
        parsed.push({ name, count, elIndex: idx });
      }
    });

    const voetbal = parsed.find(b => b.name.toLowerCase() === 'voetbal');
    if (voetbal && voetbal.count >= 2) {
      return { chosen: voetbal.name, index: voetbal.elIndex };
    }

    const viable = parsed.filter(b => b.count >= 2);
    if (viable.length > 0) {
      viable.sort((a, b) => b.count - a.count);
      const best = viable[0];
      return { chosen: best.name, index: best.elIndex };
    }

    parsed.sort((a, b) => b.count - a.count);
    if (parsed.length > 0) {
      const fallback = parsed[0];
      return { chosen: fallback.name + ' (fallback)', index: fallback.elIndex };
    }
    console.log('Parsed buttons:', JSON.stringify(parsed, null, 2));

    return { chosen: 'none', index: -1 };
  });


await sleep(2280);
try {
  await page.evaluate((index: number) => {
    const topSection = document.querySelector('.ta-FlexPane.ta-TopSportsView');
    if (!topSection) return;
    const buttons = topSection.querySelectorAll('.ta-Button.ta-MenuRowItem');

    if (typeof index === 'number' && index >= 0 && index < buttons.length) {
      const btn = buttons[index];
      btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      (btn as HTMLElement).click();
    }
  }, selectedSport.index);

  console.log(`➡ Clicked "Alles in-play ${selectedSport.chosen}"`);
  await page.waitForNetworkIdle({ idleTime: 2000, timeout: 10000 });
} catch {
  console.log(` Could not click the in-play ${selectedSport.chosen} button`);
}

await sleep(1500);

await page.evaluate(() => {
  const topView = document.querySelector('.ta-FlexPane.ta-TopSportsView');
  if (!topView) return;

  const labels = topView.querySelectorAll('.ta-imageButtonLabel');
  const lastLabel = labels[labels.length - 1] as HTMLElement;

  if (lastLabel) {
    lastLabel.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => lastLabel.click(), 500);
  }
});

await sleep(1892);
try {
  await page.waitForSelector('.ta-FlexPane.ta-EventsCoupon');
} catch {
  console.log(' Events did not appear');
  await browser.close();
  return;
}




  console.log(' Expanding all collapsed match groups...');
  await page.evaluate(() => {
    const groups = Array.from(document.querySelectorAll('.ta-FlexPane.ta-EventsCoupon.ta-EventListGroup'));

    groups.forEach(group => {
      const rotatable = group.querySelector('.ta-RotatableImage');
      const transform = rotatable?.getAttribute('style') || '';
      if (transform.includes('180deg')) {
        const button = group.querySelector('.ta-GroupHeader');
        if (button) {
          button.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setTimeout(() => (button as HTMLElement).click(), 980);
        }
      }
    });
  });
  console.log(' Finished expanding all groups');

  await sleep(2111);

  const result = await page.evaluate(() => {
    const allMatches: {
      groupIndex: number;
      matchIndex: number;
      team1: string;
      team2: string;
      odds_team1_win: string;
      odds_team2_win: string;
      matchMinOdd: number;
    }[] = [];

    const groups = document.querySelectorAll('.ta-FlexPane.ta-EventsCoupon');

    groups.forEach((group, groupIdx) => {
      const events = group.querySelectorAll('.ta-EventListItem');
      events.forEach((event, matchIdx) => {
        const teams = event.querySelectorAll('.ta-participantName');
        const odds = event.querySelectorAll('.ta-price_text');

        const team1 = teams[0]?.textContent?.trim() || 'N/A';
        const team2 = teams[1]?.textContent?.trim() || 'N/A';

        let odds1 = odds[0]?.textContent?.trim() || 'N/A';
        let odds2 = odds[2]?.textContent?.trim() || 'N/A';
        if (odds.length === 2) {
          odds2 = odds[1]?.textContent?.trim() || 'N/A';
        }

        const parsed = [odds1, odds2].map(o => parseFloat(o.replace(',', '.')));
        const matchMinOdd = Math.min(...parsed.filter(n => !isNaN(n)));

        if (team1 !== 'N/A' && team2 !== 'N/A' && !isNaN(matchMinOdd)) {
          allMatches.push({
            groupIndex: groupIdx,
            matchIndex: matchIdx,
            team1,
            team2,
            odds_team1_win: odds1,
            odds_team2_win: odds2,
            matchMinOdd
          });
        }
      });
    });

    allMatches.sort((a, b) => a.matchMinOdd - b.matchMinOdd);
    const safestMatches = allMatches.slice(0, 2);
    return { allMatches, safestMatches };
  });

  console.log(' 2 Matches with Lowest Odds:');
  console.table(result.safestMatches);

  await sleep(3443);

  console.log(' Clicking the 2 safest matches...');
  await page.evaluate((safestMatches: any[]) => {
    const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
    const groups = document.querySelectorAll('.ta-FlexPane.ta-EventList');

    (async () => {
      for (const match of safestMatches) {
        const group = groups[match.groupIndex];
        if (!group) continue;
        const events = group.querySelectorAll('.ta-EventListItem');
        const event = events[match.matchIndex];
        if (!event) continue;

        const buttons = event.querySelectorAll('.ta-SelectionButtonView.ta-Normal.inactive');
        if (buttons.length >= 3) {
          const getText = (el: Element | null) => el?.textContent?.replace(',', '.') || '999';
          const odd0 = parseFloat(getText(buttons[0]));
          const odd2 = parseFloat(getText(buttons[2]));
          const minIndex = odd0 <= odd2 ? 0 : 2;
          const target = buttons[minIndex] as HTMLElement;
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          await delay(566);
          target.click();
          await delay(1222);
        }
      }
    })();
  }, result.safestMatches);

  console.log(' Clicked lowest odds buttons.');

  await page.waitForSelector('.ta-FlexPane.ta-bettingCenterView', { timeout: 10000 });
  await sleep(20000);

  const inputSelector = '.ta-TextInput.text-input.ta-StakeInput';
  await page.focus(inputSelector);
  await page.click(inputSelector, { clickCount: 3 });
  await page.keyboard.press('Backspace');
  await page.type(inputSelector, '100');

  await sleep(6000);

  await page.click('.ta-Button.ta-AnimatedButton-button.ta-placeBetslipButton');

  console.log('Placed bet with 100 stake');

  await sleep(10000);
  await browser.close();
})();
