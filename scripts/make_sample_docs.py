"""Generate Groundwork's sample documents (public/samples/).

Northwind Ops is a fictional company. Every word below is original text
written for this demo; nothing is copied from a real company's policies.

Facts are placed on known pages so citations can be checked by hand:

Remote Work Policy (6 pages)
  p1 purpose, scope, effective date
  p2 eligibility and remote days: up to 3 remote days a week after 90 days;
     Tuesday and Thursday are in-office anchor days
  p3 equipment: company laptop, one-time $450 home-office stipend
  p4 core hours 10:00-15:00 Pacific; reply within 2 business hours
  p5 security: VPN, lost device reported within 24 hours
  p6 working from another country: up to 20 working days a year, request
     30 days ahead

Expense Guidelines (11 pages)
  p1 purpose      p2 approval thresholds   p3 submitting (30 days, receipts > $25)
  p4 meals        p5 air travel            p6 lodging
  p7 ground transport (mileage)            p8 home internet ($50/month)
  p9 learning budget ($1,500/year)         p10 not reimbursable
  p11 reimbursement timing (10 business days)

Run:  python3 scripts/make_sample_docs.py   (needs reportlab)
"""

from pathlib import Path

from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer

OUT = Path(__file__).resolve().parent.parent / "public" / "samples"

TITLE = ParagraphStyle("title", fontName="Helvetica-Bold", fontSize=18, leading=22, spaceAfter=6)
SUB = ParagraphStyle("sub", fontName="Helvetica", fontSize=10, leading=13, textColor="#555555", spaceAfter=14)
H = ParagraphStyle("h", fontName="Helvetica-Bold", fontSize=13, leading=17, spaceBefore=4, spaceAfter=8)
BODY = ParagraphStyle("body", fontName="Helvetica", fontSize=11, leading=15, spaceAfter=9)


def build(filename: str, title: str, pages: list[tuple[str, list[str]]]) -> None:
    total = len(pages)

    def footer(canvas, doc):
        canvas.saveState()
        canvas.setFont("Helvetica", 9)
        canvas.setFillColor("#777777")
        canvas.drawString(inch, 0.6 * inch, f"Northwind Ops - {title}")
        canvas.drawRightString(letter[0] - inch, 0.6 * inch, f"Page {doc.page} of {total}")
        canvas.restoreState()

    story = []
    for i, (heading, paragraphs) in enumerate(pages):
        if i == 0:
            story.append(Paragraph(f"Northwind Ops {title}", TITLE))
            story.append(Paragraph("Fictional sample document for the Groundwork demo. Version 2.1, effective March 1, 2026.", SUB))
        story.append(Paragraph(heading, H))
        for p in paragraphs:
            story.append(Paragraph(p, BODY))
        if i < total - 1:
            story.append(PageBreak())

    OUT.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(OUT / filename),
        pagesize=letter,
        title=f"Northwind Ops {title}",
        author="Northwind Ops People Operations (fictional)",
        leftMargin=inch, rightMargin=inch, topMargin=inch, bottomMargin=inch,
    )
    doc.build(story, onFirstPage=footer, onLaterPages=footer)


REMOTE = [
    ("1. Purpose and scope", [
        "This policy explains how Northwind Ops employees may work away from the office. It applies to all "
        "full-time and part-time employees in the United States and Canada. Contractors follow the terms of "
        "their own agreements.",
        "Remote work is a working arrangement, not a benefit that changes pay, title, or performance "
        "expectations. People Operations owns this policy and reviews it every January.",
        "Questions about this policy go to the #people-ops channel or to peopleops@northwind-ops.example.",
    ]),
    ("2. Eligibility and remote days", [
        "Employees become eligible for remote work after completing their first 90 days at Northwind Ops. "
        "During those first 90 days, new hires work from their assigned office five days a week so they can "
        "learn the team's routines.",
        "Once eligible, an employee may work remotely up to three days per week. The remaining two days are "
        "worked in the office. Tuesday and Thursday are company-wide anchor days, and everyone who works near "
        "an office is expected on site on those two days.",
        "Remote days do not roll over. Unused remote days in one week cannot be saved for a later week. A "
        "manager may approve a temporary fully remote arrangement of up to four weeks for medical or family "
        "reasons.",
    ]),
    ("3. Equipment and home office", [
        "Northwind Ops provides every employee with a company laptop, a headset, and one external monitor on "
        "request. Company equipment stays the property of Northwind Ops and must be returned within 10 days "
        "of leaving the company.",
        "Eligible remote employees receive a one-time home-office stipend of $450 to buy a chair, desk lamp, "
        "or other items for a safe workspace. The stipend is paid through payroll after the employee submits "
        "receipts. It is available once per employee, not once per year.",
        "Ongoing home internet costs are covered separately under the Expense Guidelines.",
    ]),
    ("4. Core hours and availability", [
        "Core hours at Northwind Ops are 10:00 a.m. to 3:00 p.m. Pacific Time, Monday through Friday. All "
        "employees, wherever they work, should be available for meetings and messages during core hours.",
        "Outside core hours, employees may arrange their schedule with their manager, as long as they work "
        "their agreed weekly hours.",
        "During core hours, reply to direct messages from teammates within two business hours. Set your chat "
        "status to Away and add a calendar block when you are unavailable for more than an hour.",
    ]),
    ("5. Security when working remotely", [
        "Connect to the Northwind Ops VPN whenever you work on company systems outside an office. Never use "
        "public Wi-Fi for company work without the VPN turned on.",
        "Lock your laptop whenever you step away from it, and do not let family members or friends use "
        "company devices.",
        "Report a lost or stolen device to the IT help desk within 24 hours by emailing "
        "it-help@northwind-ops.example, so the device can be locked and wiped.",
    ]),
    ("6. Working from another country", [
        "Employees may work from a country other than their country of employment for up to 20 working days "
        "per calendar year. This limit exists because of tax and employment law, not because of performance.",
        "Submit a request to your manager and to People Operations at least 30 days before the trip. Both "
        "must approve it before you travel. Core hours still apply in Pacific Time while you are abroad.",
        "Working from another country for more than 20 working days requires a written exception from the "
        "Chief People Officer.",
    ]),
]

EXPENSES = [
    ("1. Purpose", [
        "These guidelines explain which work expenses Northwind Ops reimburses and how to claim them. They "
        "apply to every employee who spends personal money on company business.",
        "When a situation is not covered here, spend as if it were your own money and ask the Finance team "
        "in the #finance-help channel before you buy.",
    ]),
    ("2. Approval thresholds", [
        "Expenses under $75 do not need approval before purchase.",
        "Expenses from $75 to $500 need written approval from your manager before purchase. An approving "
        "chat message or email is enough.",
        "Expenses over $500 need approval from a department director before purchase. Software subscriptions "
        "of any amount must also be approved by the IT team.",
    ]),
    ("3. Submitting an expense claim", [
        "Submit every expense claim in Ledgerly, the company expense tool, within 30 days of the purchase. "
        "Claims submitted later than 30 days may be declined.",
        "Attach an itemized receipt for any expense over $25. A credit card statement alone is not a receipt.",
        "Each claim must name the business purpose, for example the customer visited or the project the "
        "purchase supports.",
    ]),
    ("4. Meals", [
        "While traveling overnight for work, you may claim meals up to $65 per day in total.",
        "When you host a client or candidate, the limit is $90 per person, including tax and tip. List every "
        "attendee on the claim.",
        "Team meals in your home city are reimbursed only when a director has approved them in advance.",
    ]),
    ("5. Air travel", [
        "Book economy class for flights shorter than six hours. Premium economy is allowed for flights of six "
        "hours or longer.",
        "Book flights at least 14 days before departure when possible. Checked bag fees for one bag are "
        "reimbursed; seat upgrades are not.",
    ]),
    ("6. Lodging", [
        "Hotel stays are reimbursed up to $220 per night before taxes.",
        "In high-cost cities (New York, San Francisco, Boston, London, and Toronto) the nightly limit is $320 "
        "before taxes.",
        "Book through the company travel portal so Finance can see the booking and help if plans change.",
    ]),
    ("7. Ground transportation", [
        "Using your personal car for business is reimbursed at $0.67 per mile. Your daily commute to your "
        "assigned office is not reimbursable.",
        "Taxis and rideshare trips are reimbursed for business travel. Choose the standard service level, not "
        "premium cars.",
        "Parking and tolls on business trips are reimbursed with a receipt.",
    ]),
    ("8. Home internet", [
        "Employees approved for remote work under the Remote Work Policy may claim up to $50 per month toward "
        "home internet service.",
        "Submit the internet claim once per quarter in Ledgerly with your provider's bill attached.",
        "Mobile phone plans are not reimbursed unless your role requires on-call duty.",
    ]),
    ("9. Training and conferences", [
        "Each employee has a learning budget of $1,500 per calendar year for courses, books, certifications, "
        "and conference tickets.",
        "Ask your manager to approve a training expense before you buy it. Unused learning budget does not "
        "carry over to the next year.",
        "Travel to a conference counts against the travel rules in these guidelines, not the learning budget.",
    ]),
    ("10. Expenses that are not reimbursable", [
        "Northwind Ops does not reimburse: alcohol, except at an approved client dinner; traffic or parking "
        "fines; airline seat or hotel room upgrades; personal entertainment such as in-flight movies; or "
        "expenses for family members who travel with you.",
        "Gifts to clients over $50 per person need director approval and are recorded by Finance.",
    ]),
    ("11. Reimbursement timing", [
        "Approved claims are paid within 10 business days of approval, through the next regular payroll.",
        "If a claim is declined, Ledgerly shows the reason, and you may correct and resubmit it once.",
        "Employees who travel more than twice a month may request a company card from Finance instead of "
        "paying personally.",
    ]),
]

if __name__ == "__main__":
    build("remote-work-policy.pdf", "Remote Work Policy", REMOTE)
    build("expense-guidelines.pdf", "Expense Guidelines", EXPENSES)
    print("wrote", ", ".join(p.name for p in sorted(OUT.glob("*.pdf"))))
