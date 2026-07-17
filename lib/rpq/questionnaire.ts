import type { RiskProfile, RpqQuestion, RpqSection } from "@/types/rpq";

const text = (zh: string, en: string) => ({ zh, en });
const option = (
  id: string,
  zh: string,
  en: string,
  score: number,
  aliases: string[] = [],
) => ({ id, label: text(zh, en), score, aliases });

export const RPQ_SECTIONS: RpqSection[] = [
  { id: "basic", title: text("基本資料", "Basic Information") },
  {
    id: "experience",
    title: text("投資取向及經驗", "Investment Preference and Experience"),
  },
  { id: "tolerance", title: text("風險承受", "Risk Tolerance") },
  { id: "financial", title: text("財務狀況", "Financial Circumstances") },
];

export const RPQ_QUESTIONS: RpqQuestion[] = [
  {
    id: "age",
    number: 1,
    sectionId: "basic",
    type: "single",
    prompt: text("請選出您所屬的年齡組別", "Please indicate the age group that you belong to."),
    options: [
      option("18-30", "18 - 30 歲", "Age 18 - 30", 5, ["18 to 30", "eighteen to thirty"]),
      option("31-44", "31 - 44 歲", "Age 31 - 44", 4, ["31 to 44", "thirty one to forty four"]),
      option("45-54", "45 - 54 歲", "Age 45 - 54", 3, ["45 to 54", "forty five to fifty four"]),
      option("55-64", "55 - 64 歲", "Age 55 - 64", 2, ["55 to 64", "fifty five to sixty four"]),
      option("65-plus", "65 歲或以上", "Age 65 or above", 1, ["65 or above", "sixty five or above", "over 65"]),
    ],
  },
  {
    id: "education",
    number: 2,
    sectionId: "basic",
    type: "single",
    prompt: text("您的最高學歷是", "What is your highest education level?"),
    options: [
      option("university", "大學或以上", "University or above", 5, ["university", "degree", "college"]),
      option("post-secondary", "預科/高級文憑/副學士/其他同等學歷畢業", "Post-Secondary / High Diploma / Associate Degree / equivalent qualifications", 4, ["post secondary", "diploma", "associate degree"]),
      option("secondary", "中學畢業", "Secondary Completed", 3, ["secondary", "high school"]),
      option("primary", "小學畢業", "Primary Completed", 2, ["primary school"]),
      option("below-primary", "小學以下", "Below Primary", 1, ["below primary"]),
    ],
  },
  {
    id: "investment-experience",
    number: 3,
    sectionId: "experience",
    type: "single",
    prompt: text("您有多少年投資經驗（不包括儲蓄、定期儲蓄及外幣儲蓄）？", "How many years of investment experience, excluding savings, fixed deposits and foreign currency deposits, do you have?"),
    options: [
      option("over-10", "多於 10 年", "Over 10 years", 5, ["over ten years", "more than ten"]),
      option("7-10", "7-10 年", "7 - 10 years", 4, ["seven to ten"]),
      option("4-6", "4-6 年", "4 - 6 years", 3, ["four to six"]),
      option("1-3", "1-3 年", "1 - 3 years", 2, ["one to three"]),
      option("under-1", "少於 1 年", "Less than 1 year", 1, ["less than one", "under one"]),
    ],
  },
  {
    id: "products",
    number: 4,
    sectionId: "experience",
    type: "multi",
    prompt: text("您在過去三年曾投資以下哪些投資產品最少五次？可選擇多於一項，惟只以分數最高的選項作計算。", "Which products have you invested in at least five times during the past three years? Select all that apply; only the highest selected score is counted."),
    footnote: text("以投資壽險及互惠基金投資而言，每項認購、定期供款、定期額外供款或轉入一項投資選擇會被視為一次投資。", "For ILAS and mutual funds, each subscription, regular contribution, additional contribution, or switch-in is counted as one investment."),
    options: [
      option("derivatives", "衍生產品", "Derivatives", 5, ["derivatives", "structured products", "margin fx"]),
      option("stocks", "證券", "Stocks", 4, ["stocks", "shares", "securities"]),
      option("funds", "投資壽險（非衍生產品基金）/互惠基金（非衍生產品基金）", "ILAS / Mutual Funds (non-derivative fund)", 3, ["funds", "mutual funds", "ilas"]),
      option("bonds", "債券", "Bonds", 2, ["bonds", "bond"]),
      option("none", "沒有/儲蓄/定期儲蓄/外幣儲蓄/存款證/存款", "None / Savings / Fixed Deposits / Foreign Currency / Certificates of Deposit / Deposits", 1, ["none", "savings", "fixed deposits", "deposit"]),
    ],
  },
  {
    id: "withdrawal-horizon",
    number: 5,
    sectionId: "experience",
    type: "single",
    prompt: text("您預計何時開始提取投資款項？", "When do you expect to start withdrawing your investment?"),
    options: [
      option("over-20", "多於 20 年", "Over 20 years", 5, ["over twenty", "more than twenty"]),
      option("11-20", "11-20 年", "11 - 20 years", 4, ["eleven to twenty"]),
      option("6-10", "6 - 10 年", "6 - 10 years", 3, ["six to ten"]),
      option("1-5", "1-5 年", "1 - 5 years", 2, ["one to five"]),
      option("under-1", "少於 1 年", "Less than 1 year", 1, ["less than one", "under one"]),
    ],
  },
  {
    id: "objective",
    number: 6,
    sectionId: "experience",
    type: "single",
    prompt: text("下列那項陳述最能表達您現時的投資目的？", "Which statement best describes your current investment objective?"),
    options: [
      option("maximize-growth", "以最短時間，爭取最高回報", "Maximize capital growth as soon as possible", 5, ["maximize growth", "highest return"]),
      option("long-term-growth", "資本長期地逐漸增長", "Gradual long-term capital growth", 4, ["long term growth"]),
      option("balanced", "穩定、平衡收入與資本增長", "Stable, balanced income and capital growth", 3, ["balanced income", "balanced"]),
      option("above-deposit", "賺取略高於銀行存款的回報", "Earn a return slightly above bank deposit", 2, ["above deposit", "slightly above"]),
      option("preservation", "保本及賺取相約於銀行存款的回報率", "Capital preservation with a return similar to bank deposit", 1, ["capital preservation", "preserve capital"]),
    ],
  },
  {
    id: "risk-attitude",
    number: 7,
    sectionId: "tolerance",
    type: "single",
    prompt: text("下列那項陳述最能表達您對風險的態度？", "Which statement best describes your attitude towards investment risk?"),
    options: [
      option("ignore-risk", "我不會考慮風險，務求得到最高回報", "I never consider risks, as I aim to maximize returns", 5, ["never consider risk", "maximize returns"]),
      option("higher-risk", "我願意承受較高的風險，以換取更高回報", "I am willing to accept more risks for higher returns", 4, ["higher risk", "more risk"]),
      option("balance-risk", "我會盡量平衡風險與回報", "I will try to strike a balance between risks and returns", 3, ["balance risk", "balance"]),
      option("avoid-risk", "我會盡量迴避風險，但仍可承受較低的波動", "I will try to avoid risks but minor ones are still acceptable", 2, ["avoid risk", "minor risk"]),
      option("no-risk", "我不願意承受任何風險", "I do not want to take any risks", 1, ["no risk", "any risk"]),
    ],
  },
  {
    id: "volatility",
    number: 8,
    sectionId: "tolerance",
    type: "single",
    prompt: text("一般而言，預期較高回報會涉及較高的價格波幅。您可以接受以下哪個年度價格波幅？", "Which level of annualized price fluctuation are you comfortable with?"),
    options: [
      option("20", "價格波幅 -20% 至 +20%", "Price fluctuates between -20% and +20%", 5, ["twenty percent", "20 percent"]),
      option("15", "價格波幅 -15% 至 +15%", "Price fluctuates between -15% and +15%", 4, ["fifteen percent", "15 percent"]),
      option("10", "價格波幅 -10% 至 +10%", "Price fluctuates between -10% and +10%", 3, ["ten percent", "10 percent"]),
      option("5", "價格波幅 -5% 至 +5%", "Price fluctuates between -5% and +5%", 2, ["five percent", "5 percent"]),
      option("0", "沒有價格波幅", "No price fluctuation", 1, ["no fluctuation", "zero percent"]),
    ],
  },
  {
    id: "market-fall",
    number: 9,
    sectionId: "tolerance",
    type: "single",
    prompt: text("如果您投資了 HK$100,000，但在短時間內價格大幅下跌，您會如何處理？", "You invested HK$100,000 and its value fell dramatically in a short period. What would you do?"),
    options: [
      option("buy-more", "我將適量增持以降低平均投資成本", "I will adequately invest more to lower the average cost", 5, ["buy more", "invest more", "average cost"]),
      option("hold", "我將繼續持有現有投資並觀望其長線增長", "I will hold the investment for long-term growth", 4, ["hold", "hold investment"]),
      option("sell-small", "我將出售小部份投資，並持有餘下的投資", "I will sell a small part and hold the remaining investment", 3, ["sell small", "sell a small part"]),
      option("sell-large", "我將出售大部份投資，並持有餘下的投資", "I will sell a large part and hold the remaining investment", 2, ["sell large", "sell a large part"]),
      option("sell-all", "我將立即出售所有投資以防止進一步的損失", "I will sell all investments immediately to prevent further losses", 1, ["sell all", "immediately sell"]),
    ],
  },
  {
    id: "investment-portion",
    number: 10,
    sectionId: "financial",
    type: "single",
    prompt: text("您用作此投資的金額佔您的流動淨資產多少個百分比？", "What portion of your current net worth assets is reserved for this investment?"),
    footnote: text("流動資產並不包括物業、車輛及保險等不容易轉化為現金的資產。", "Current net worth assets exclude real estate, cars, and insurance."),
    options: [
      option("under-20", "少於 20%", "Less than 20%", 5, ["less than twenty", "under twenty"]),
      option("21-40", "21% - 40%", "21% - 40%", 4, ["twenty one to forty"]),
      option("41-60", "41% - 60%", "41% - 60%", 3, ["forty one to sixty"]),
      option("61-80", "61% - 80%", "61% - 80%", 2, ["sixty one to eighty"]),
      option("over-80", "80% 以上", "Above 80%", 1, ["above eighty", "over eighty"]),
    ],
  },
  {
    id: "emergency-fund",
    number: 11,
    sectionId: "financial",
    type: "single",
    prompt: text("您現時的流動淨資產足夠應付多少個月的日常家庭開支，以面對突如其來的情況？", "How many months of household expenses could be covered by your current net worth assets for unforeseen events?"),
    options: [
      option("over-12", "超過 12 個月", "More than 12 months", 5, ["more than twelve", "over twelve"]),
      option("6-12", "6-12 個月", "6-12 months", 4, ["six to twelve"]),
      option("3-6", "3-6 個月", "3-6 months", 3, ["three to six"]),
      option("under-3", "少於 3 個月", "Less than 3 months", 2, ["less than three", "under three"]),
      option("none", "沒有", "None", 1, ["none", "zero"]),
    ],
  },
  {
    id: "future-investable",
    number: 12,
    sectionId: "financial",
    type: "single",
    prompt: text("您預計未來五年每月可投資之金額會怎樣？", "How do you expect your future monthly investable amount over the next five years?"),
    options: [
      option("increase-significantly", "預計每月可投資之金額會急升", "Increase significantly", 5, ["increase significantly", "rise significantly"]),
      option("increase-accelerating", "預計每月可投資之金額會逐漸上升並且上升幅度會愈來愈大", "Increase gradually at an accelerating rate", 4, ["accelerating increase", "increase accelerating"]),
      option("increase-steady", "預計每月可投資之金額會逐漸平穩地上升", "Increase gradually at a steady rate", 3, ["steady increase", "increase steadily"]),
      option("unchanged", "預計每月可投資之金額會維持不變", "Remain unchanged", 2, ["unchanged", "remain unchanged"]),
      option("decrease", "預計每月可投資之金額會減少", "Decrease", 1, ["decrease", "reduce"]),
    ],
  },
];

export const RISK_PROFILES: RiskProfile[] = [
  {
    id: "conservative", minScore: 12, maxScore: 21,
    tolerance: text("低", "Low"), profile: text("保守型", "Conservative"),
    description: text("投資者對風險採取比較保守的態度及重視保存資本。", "An investor who is risk-averse and to whom capital preservation is very important."),
  },
  {
    id: "stable", minScore: 22, maxScore: 30,
    tolerance: text("低-中", "Low-Medium"), profile: text("穩健型", "Stable"),
    description: text("投資者喜愛有資本增值的潛力的投資，同時亦明白到需要承擔低至中程度風險。", "An investor who would like capital gain potential and understands they need to take a low to medium level of risk."),
  },
  {
    id: "balance", minScore: 31, maxScore: 40,
    tolerance: text("中", "Medium"), profile: text("平衡型", "Balance"),
    description: text("投資者願意承擔中程度的風險。", "An investor who is willing to accept a medium level of risk."),
  },
  {
    id: "growth", minScore: 41, maxScore: 50,
    tolerance: text("中至高", "Medium-High"), profile: text("增長型", "Growth"),
    description: text("投資者喜愛有較大資本增值潛力的投資，同時明白到需要承擔高程度的風險。", "An investor who would like greater capital gain potential and understands they need to take a high level of risk."),
  },
  {
    id: "aggressive", minScore: 51, maxScore: 60,
    tolerance: text("高", "High"), profile: text("進取型", "Aggressive"),
    description: text("投資者喜愛有可觀資本增值的投資，同時亦明白到要承擔相當高程度的風險。", "An investor who would like significant capital gain and understands they need to take a very high level of risk."),
  },
];

export const RPQ_DISCLAIMER =
  "This is an educational demonstration only and is not investment advice. Results must be reviewed by a qualified adviser before any investment decision is made.";

export function getRpqQuestion(id: string) {
  return RPQ_QUESTIONS.find((question) => question.id === id);
}
