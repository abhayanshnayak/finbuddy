# Functional Requirements: Stock Research App

## Document Overview
This document outlines the functional requirements for a stock research application. The application will be built in phases, adding functionality incrementally. The primary persona is an **individual investor** who wants to understand a company's business model, accurately evaluate it, calculate its fair value, and determine a discounted purchase price (Margin of Safety).

---

## Phase 1 Requirements

### 1. Stock Search and Selection
The application must allow users to easily find and select companies for analysis.
- **Search Input:** A search bar allowing users to enter either a stock symbol (ticker/exchange code) or the full name of the company.
- **Autocomplete/Typeahead:** The system must provide autocomplete suggestions to the user after they type the first 2 characters.
- **Fresh Data Toggle:** A toggle allowing the user to bypass the database cache and retrieve fresh data.
- **Selection:** Selecting a stock from the autocomplete list or hitting enter on a valid symbol will trigger the generation of a detailed valuation report.

### 2. Report Generation Engine
Upon selecting a stock, the app will generate a detailed valuation report. The report will synthesize financial data to match a specific investment framework (The 4 "M"s).

The generated report must include the following sections and data points:

#### A. Company Overview (Meaning & Moat)
**Data Source Requirement:** The application must extract and synthesize information from the company's **recent 3 10-K filings** to populate the following fields:
- **General Info:** Company Name, Industry, Sector, Subsector, Industry Group (if applicable), Competitors.
- **Company Overview:** A comprehensive, multi-paragraph overview of the company's business model, core operations, and context.
- **Snapshot Info:** 
  1. Store and show the price of the ticker when it was stored in the db.
  2. Store in the db and show the industry, sector, subsector, and industry group if applicable.
  3. Save the timestamp when the ticker data was fetched and display that in the report in PST in Day Month hh:mm format (e.g., 5 Jan 1:30pm).
- **Strategic Insight:** Growth plans, Challenges & risks.
- **Moat Analysis:** 
  - Types of moats (Brand, IP, Switching cost, Toll bridge, Pricing power, Network effect, Price elasticity).
  - Comparison of the moat against competitors.
  - Financial resilience: Cash available, Number of years it can withstand an economic downturn.
- **Market Sentiment:** Who is buying the stock (e.g., specific gurus or institutional trends).

#### D. Growth Company Evaluation
For companies with negative cash flows or no current profitability, evaluate:
1. Is the cash burn funding structural deficits or aggressive growth/R&D?
2. Are the gross margins high enough to support future profitability?
3. Is there a clear, mathematically sound "path to profitability" in the next 3-5 years?
4. Do they have enough cash on the balance sheet (runway) to survive until they turn cash-flow positive without needing highly dilutive funding?

#### B. Core Growth Indicators (The "Big 4" Numbers) & Alternative Metrics
The app must retrieve and calculate historical growth rates to display a table with **3-year, 5-year, and 10-year** averages for:
- Revenue (Sales)
- Net Income
- Book Value (Equity + Dividends)
- Operating Cash Flow

Additionally, compute and display:
- **Rule of 40:** Revenue Growth Rate + Free Cash Flow Margin.
- **EV/Revenue (Enterprise Value to Revenue):** Enterprise Value / Latest Revenue.

#### C. Management Quality Metrics
The app must retrieve and calculate data to evaluate management performance, displaying **3-year, 5-year, and 10-year** metrics for:
- ROE (Return on Equity)
- ROIC (Return on Invested Capital)
- Debt levels

**Additional Management Details:**
- Total Debt and Free Cash Flow (FCF).
- Number of years to pay off debt (Assuming no change in cash flow).
- Employee happiness & CEO rating (by employees).
- Board of Directors composition, accomplishments, and average tenure.
- CEO tenure.

#### D. Valuations & Pricing
The app must compute and clearly present pricing models to help the investor understand the fair value and the discounted price (Margin of Safety). **Crucially, the report must show all inputs and step-by-step math followed in the computation so the user can verify the calculations.**

- **Windage Growth Rate:** Average of the growth rates within 1 standard deviation over the past 10 years. This rate must be explicitly displayed as a key input before any calculations.
- **Payback Time:** Time it takes to get invested principal back using Free Cash Flow (FCF).
  - **Data Presentation:** The report must include a table with columns for **Year** (1 through 10) and the projected **FCF** for each year.
  - Calculate the projected per-year FCF for the next 10 years by growing current FCF by the explicitly stated Windage Growth Rate each year.
  - Calculate 8-year payback: Sum the projected FCF for the first 8 years. If this sum is greater than the current market cap, the company is trading at a discount.
  - Calculate 10-year payback: Sum the projected FCF for the first 10 years. If this sum is greater than the current market cap, it is trading at a reasonable discount.
- **Margin of Safety (MOS) & Sticker Price Method:** Uses a 15% Minimum Acceptable Rate of Return (MARR). All formulas below must be shown with their evaluated numbers.
  - **Windage PE Ratio:** The lower of `2 × Windage GR` OR the `highest PE in the last 10 years`.
  - **Step 1 (Future EPS):** Current EPS × (1 + Windage GR)¹⁰
  - **Step 2 (Future Share Price):** Future EPS × Windage PE Ratio
  - **Step 3 (Sticker Price / Fair Value):** Future Share Price / (1.15)¹⁰
  - **Step 4 (Buy Price with MOS):** Sticker Price / 2

#### E. Avoiding Confirmation Bias Checklist
A checklist customized to the company evaluating:
- Are we outside the circle of competence?
- Is the industry declining?
- Are the Big 4 numbers failing to grow?
- Is debt increasing?
- Is EPS engineered by buybacks?

### 3. Report Output & Download
- **In-App Viewing:** The user should be able to view the fully formatted report directly within the application's UI.
- **Downloadable Format:** The report must be downloadable by the user (e.g., as a PDF, Markdown, or Word document) so they can save or print it for their records.

---

## Phase 2 Requirements

### 1. Bulk Stock Ingestion & Caching
To support batch processing and improve application responsiveness, a bulk ingestion interface and caching mechanism must be implemented.

#### A. Bulk Input Interface
- **Input Page/View:** A new, dedicated page within the application to perform bulk stock imports.
- **Input Mechanism:** An input text area that accepts up to **500 stock symbols**, separated by commas, spaces, or newlines.
- **Fresh Data Toggle:** A toggle allowing the user to bypass the database cache and force retrieval of fresh data for all symbols in the batch.
- **Input Validation:**
  - Enforce the maximum limit of 500 stock symbols per batch.
  - Basic validation of ticker symbol formats.
  - De-duplicate symbols from the input list before starting the import process.

#### B. Data Retrieval & Ingestion Pipeline
- **Queued/Parallel Processing:** The backend must fetch, process, and calculate all of the data points defined in Phase 1 (Company Overview, Core Growth Indicators, Management Quality Metrics, Valuations & Pricing, and Confirmation Bias Checklist) for all provided stock symbols.
- **Progress Tracking:** The UI must display real-time or near-real-time feedback showing:
  - Total number of symbols to process.
  - Overall progress (e.g., percentage completed or progress bar).
  - A status list detailing which tickers succeeded, which failed, and any associated error messages.

#### C. Database Storage & Caching Policy
- **Persistent Database Storage:** All fetched and computed data points for each processed symbol must be stored in the central database (e.g., Cloud Firestore).
- **Caching Mechanism / Fast Retrieval:**
  - When a user searches for or requests a report for a single stock symbol (via the Phase 1 search interface) or processes a batch, the application must first query the database, unless the "Fresh Data" toggle is enabled.
  - If valid data exists in the database for that symbol (and "Fresh Data" is not forced), the application must immediately retrieve and serve it from the database instead of fetching it from external APIs and processing files, ensuring sub-second response times.
  - If the stock data does not exist or has expired (cache miss), the system will fetch the data on-demand, compute the metrics, display them to the user, and write them back to the database for future queries.

