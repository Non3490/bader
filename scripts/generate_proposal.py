#!/usr/bin/env python3
"""
SaaS COD Fulfillment Platform Proposal for Gabon COD Platform
Professional PDF Document Generator
"""

from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.lib import colors
from reportlab.lib.units import inch, cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily
import os

# Register fonts
pdfmetrics.registerFont(TTFont('Times New Roman', '/usr/share/fonts/truetype/english/Times-New-Roman.ttf'))
registerFontFamily('Times New Roman', normal='Times New Roman', bold='Times New Roman')

# Output path
output_path = "/home/z/my-project/download/Gabon_COD_Platform_Proposal.pdf"

# Create document
doc = SimpleDocTemplate(
    output_path,
    pagesize=A4,
    rightMargin=2*cm,
    leftMargin=2*cm,
    topMargin=2*cm,
    bottomMargin=2*cm,
    title="Gabon COD Platform - SaaS Proposal",
    author="Z.ai",
    creator="Z.ai",
    subject="Professional SaaS COD Fulfillment Platform Proposal"
)

# Define styles
styles = getSampleStyleSheet()

# Custom styles
cover_title_style = ParagraphStyle(
    name='CoverTitle',
    fontName='Times New Roman',
    fontSize=36,
    leading=44,
    alignment=TA_CENTER,
    textColor=colors.HexColor('#1F4E79'),
    spaceAfter=20
)

cover_subtitle_style = ParagraphStyle(
    name='CoverSubtitle',
    fontName='Times New Roman',
    fontSize=18,
    leading=24,
    alignment=TA_CENTER,
    textColor=colors.HexColor('#2C3E50'),
    spaceAfter=40
)

cover_info_style = ParagraphStyle(
    name='CoverInfo',
    fontName='Times New Roman',
    fontSize=14,
    leading=22,
    alignment=TA_CENTER,
    textColor=colors.HexColor('#34495E'),
    spaceAfter=12
)

section_title_style = ParagraphStyle(
    name='SectionTitle',
    fontName='Times New Roman',
    fontSize=20,
    leading=28,
    alignment=TA_LEFT,
    textColor=colors.HexColor('#1F4E79'),
    spaceBefore=20,
    spaceAfter=12
)

subsection_title_style = ParagraphStyle(
    name='SubsectionTitle',
    fontName='Times New Roman',
    fontSize=14,
    leading=20,
    alignment=TA_LEFT,
    textColor=colors.HexColor('#2980B9'),
    spaceBefore=16,
    spaceAfter=8
)

body_style = ParagraphStyle(
    name='BodyStyle',
    fontName='Times New Roman',
    fontSize=11,
    leading=18,
    alignment=TA_JUSTIFY,
    textColor=colors.HexColor('#2C3E50'),
    spaceBefore=6,
    spaceAfter=8
)

bullet_style = ParagraphStyle(
    name='BulletStyle',
    fontName='Times New Roman',
    fontSize=11,
    leading=16,
    alignment=TA_LEFT,
    textColor=colors.HexColor('#2C3E50'),
    leftIndent=20,
    bulletIndent=10,
    spaceBefore=4,
    spaceAfter=4
)

highlight_style = ParagraphStyle(
    name='HighlightStyle',
    fontName='Times New Roman',
    fontSize=11,
    leading=18,
    alignment=TA_LEFT,
    textColor=colors.HexColor('#1F4E79'),
    spaceBefore=4,
    spaceAfter=4
)

# Table styles
table_header_style = ParagraphStyle(
    name='TableHeader',
    fontName='Times New Roman',
    fontSize=11,
    textColor=colors.white,
    alignment=TA_CENTER,
    leading=14
)

table_cell_style = ParagraphStyle(
    name='TableCell',
    fontName='Times New Roman',
    fontSize=10,
    textColor=colors.HexColor('#2C3E50'),
    alignment=TA_LEFT,
    leading=14
)

table_cell_center_style = ParagraphStyle(
    name='TableCellCenter',
    fontName='Times New Roman',
    fontSize=10,
    textColor=colors.HexColor('#2C3E50'),
    alignment=TA_CENTER,
    leading=14
)

# Build story
story = []

# ===== COVER PAGE =====
story.append(Spacer(1, 80))
story.append(Paragraph("SaaS COD Fulfillment Platform", cover_title_style))
story.append(Spacer(1, 20))
story.append(Paragraph("Professional Logistics &amp; Operations Management Solution", cover_subtitle_style))
story.append(Spacer(1, 60))
story.append(Paragraph("<b>Prepared for:</b>", cover_info_style))
story.append(Paragraph("Gabon COD Platform", cover_info_style))
story.append(Spacer(1, 30))
story.append(Paragraph("<b>Document Type:</b> Business Proposal", cover_info_style))
story.append(Paragraph("<b>Version:</b> 1.0", cover_info_style))
story.append(Paragraph("<b>Date:</b> January 2025", cover_info_style))
story.append(Spacer(1, 80))

# Decorative line
story.append(Table([['']], colWidths=[400], rowHeights=[3], style=TableStyle([
    ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#1F4E79')),
    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
])))

story.append(PageBreak())

# ===== EXECUTIVE SUMMARY =====
story.append(Paragraph("Executive Summary", section_title_style))

exec_summary = """This proposal presents a comprehensive SaaS (Software as a Service) platform specifically designed for Cash on Delivery (COD) fulfillment operations in the African and MENA markets. The platform addresses the unique challenges faced by e-commerce businesses in regions where cash payment on delivery remains the dominant transaction method, providing a centralized command center that transforms manual, error-prone processes into automated, transparent, and scalable operations."""
story.append(Paragraph(exec_summary, body_style))

exec_summary2 = """The solution integrates seamlessly with multiple order sources including Shopify, YouCan, Dropify, and Google Sheets, while providing dedicated interfaces for all stakeholders in the fulfillment chain: Sellers, Call Center Agents, Delivery Personnel, and Administrators. By implementing this platform, Gabon COD Platform will gain complete visibility over the entire order lifecycle, from initial customer inquiry through delivery confirmation and cash reconciliation, ultimately maximizing profitability while minimizing operational overhead and errors."""
story.append(Paragraph(exec_summary2, body_style))

story.append(Spacer(1, 20))

# ===== OVERVIEW SECTION =====
story.append(Paragraph("1. Platform Overview", section_title_style))

overview_text = """The platform serves as a centralized command center that collects orders from multiple sources, enables different user roles to perform their specific functions, and automates the entire fulfillment workflow. Unlike simple spreadsheet-based solutions, this SaaS platform provides enterprise-grade features including real-time tracking, automated carrier integrations, comprehensive financial reporting, and role-based access controls that protect sensitive business data while enabling collaborative operations."""
story.append(Paragraph(overview_text, body_style))

story.append(Paragraph("1.1 Core Value Proposition", subsection_title_style))

value_prop = """The platform eliminates the fragmented workflows that typically characterize COD operations in emerging markets. Instead of managing orders across multiple spreadsheets, manually communicating with delivery partners, and struggling to track cash collections, businesses using this platform gain a single source of truth for all operational data. The system automatically calculates profitability, manages inventory across multiple warehouses, and provides real-time visibility into the status of every order and the location of every delivery agent."""
story.append(Paragraph(value_prop, body_style))

story.append(Spacer(1, 15))

# ===== KEY FEATURES SECTION =====
story.append(Paragraph("2. Key Platform Features", section_title_style))

# Feature 1: Order Ingestion
story.append(Paragraph("2.1 Centralized Order Ingestion", subsection_title_style))

order_ingestion_intro = """The platform provides universal order collection capabilities, automatically pulling orders from multiple sales channels into a unified dashboard. This eliminates the need for manual data entry and ensures that no order is lost or duplicated across different systems."""
story.append(Paragraph(order_ingestion_intro, body_style))

order_features = [
    "<b>Universal Import:</b> Automatic synchronization with Shopify, YouCan, Dropify, and Google Sheets, with support for manual entry via web interface or CSV upload",
    "<b>Deduplication Engine:</b> Intelligent detection and blocking of duplicate orders to prevent double-shipping and associated financial losses",
    "<b>Smart Categorization:</b> Automatic classification of orders by city, product type, delivery zone, or status for efficient processing",
    "<b>Validation Rules:</b> Phone number format verification and SKU existence checks before order acceptance"
]

for feature in order_features:
    story.append(Paragraph(f"• {feature}", bullet_style))

story.append(Spacer(1, 10))

# Feature 2: Call Center Interface
story.append(Paragraph("2.2 High-Performance Call Center Interface", subsection_title_style))

call_center_intro = """The call center module provides agents with a streamlined interface designed for maximum productivity. Agents can focus exclusively on order confirmation without being exposed to sensitive business data such as profit margins or supplier costs."""
story.append(Paragraph(call_center_intro, body_style))

call_center_features = [
    "<b>Dedicated Confirmation View:</b> Simplified interface showing only orders requiring confirmation, with one-click status updates",
    "<b>Attempt Tracking:</b> Comprehensive history of call attempts including outcomes such as 'No Answer', 'Busy', 'Callback Scheduled', or 'Wrong Number'",
    "<b>Data Privacy Protection:</b> Agents access only customer contact information and order details, never seeing financial data or profit calculations",
    "<b>Performance Metrics:</b> Individual agent statistics showing confirmation rates, average handling time, and daily productivity",
    "<b>Integrated Notes:</b> Ability to attach detailed notes to each order for future reference and team collaboration"
]

for feature in call_center_features:
    story.append(Paragraph(f"• {feature}", bullet_style))

story.append(Spacer(1, 10))

# Feature 3: Delivery Agent Portal
story.append(Paragraph("2.3 Mobile Delivery Agent Portal", subsection_title_style))

delivery_intro = """The delivery agent portal represents a critical component for COD operations, as delivery personnel are responsible for both the physical product and the cash collection. The mobile-optimized interface provides all tools necessary for efficient last-mile delivery operations."""
story.append(Paragraph(delivery_intro, body_style))

delivery_features = [
    "<b>Daily Route Management:</b> Clear display of assigned orders for the day, optimized for delivery sequence and geographic efficiency",
    "<b>Instant Status Updates:</b> One-tap buttons to mark orders as Delivered, Postponed, Refused, or Partial Delivery with immediate synchronization to the main dashboard",
    "<b>Digital Proof of Delivery:</b> Capability to capture customer signatures or photographs of delivered packages directly within the application",
    "<b>Cash Reconciliation:</b> Real-time 'Cash on Hand' counter showing total amount collected and requiring remittance to the office",
    "<b>Navigation Integration:</b> Direct links to open customer locations in Google Maps or Waze for efficient route planning",
    "<b>Customer Contact:</b> One-tap calling functionality to reach customers when approaching delivery locations"
]

for feature in delivery_features:
    story.append(Paragraph(f"• {feature}", bullet_style))

story.append(Spacer(1, 10))

# Feature 4: Logistics
story.append(Paragraph("2.4 Automated Logistics &amp; Shipping Integration", subsection_title_style))

logistics_intro = """The platform provides direct API integration with major African and MENA logistics providers, automating the shipment creation process and providing real-time tracking updates without requiring manual interaction with carrier websites."""
story.append(Paragraph(logistics_intro, body_style))

logistics_features = [
    "<b>Direct Carrier Integration:</b> Instant data transmission to shipping partners including ColisSwift, Shipsen, AfriqueCod, and other regional carriers via API connections",
    "<b>Bulk Label Generation:</b> Create and print hundreds of shipping labels (Airway Bills) in seconds, supporting multiple label formats and printers",
    "<b>Real-Time Tracking:</b> Automatic status updates (Shipped, In Transit, Delivered, Returned) pushed directly from carrier systems",
    "<b>Multi-Carrier Selection:</b> Intelligent routing suggestions based on destination, cost, and historical performance metrics",
    "<b>Exception Handling:</b> Automated alerts for delivery failures, refused packages, and other exceptions requiring intervention"
]

for feature in logistics_features:
    story.append(Paragraph(f"• {feature}", bullet_style))

story.append(Spacer(1, 10))

# Feature 5: Inventory
story.append(Paragraph("2.5 Intelligent Inventory Management", subsection_title_style))

inventory_intro = """The inventory management system provides precise control over stock levels across multiple warehouse locations, with automatic updates triggered by order events and proactive alerts to prevent stockouts."""
story.append(Paragraph(inventory_intro, body_style))

inventory_features = [
    "<b>Multi-Warehouse Support:</b> Unified view of stock levels across different cities, countries, or storage facilities with location-specific quantities",
    "<b>Automatic Deduction:</b> Stock levels automatically decrease when orders are shipped, with real-time availability updates across all sales channels",
    "<b>Return Processing:</b> Streamlined workflows for reintegrating returned items (RTO) into available stock after quality verification",
    "<b>Low Stock Alerts:</b> Configurable notifications when inventory reaches critical thresholds, preventing lost sales due to stockouts",
    "<b>Stock Reservation:</b> Automatic reservation of inventory when orders are confirmed, preventing overselling of limited stock items"
]

for feature in inventory_features:
    story.append(Paragraph(f"• {feature}", bullet_style))

story.append(Spacer(1, 10))

# Feature 6: Finance
story.append(Paragraph("2.6 Financial Analytics &amp; Profitability Tracking", subsection_title_style))

finance_intro = """The financial module provides comprehensive visibility into the true profitability of each sale and the overall business, automatically calculating net margins after accounting for all operational costs."""
story.append(Paragraph(finance_intro, body_style))

finance_features = [
    "<b>Real-Time Profit Calculation:</b> Automatic computation of net profit for each sale using the formula: Revenue minus (Product Cost + Shipping Fees + Call Center Fees + Advertising Spend)",
    "<b>Automated Invoicing:</b> Professional PDF invoice generation for customers, including detailed order information and payment confirmation",
    "<b>Remittance Tracking:</b> Comprehensive monitoring of cash collected by delivery agents, showing amounts ready for payout to sellers",
    "<b>Expense Categorization:</b> Detailed breakdown of operational costs by category including shipping, returns, call center operations, and advertising",
    "<b>Profitability Reports:</b> Daily, weekly, and monthly reports showing revenue trends, margin analysis, and cost optimization opportunities"
]

for feature in finance_features:
    story.append(Paragraph(f"• {feature}", bullet_style))

story.append(Spacer(1, 15))

# ===== USER ROLES SECTION =====
story.append(Paragraph("3. User Roles &amp; Access Permissions", section_title_style))

roles_intro = """The platform implements a comprehensive role-based access control system that ensures each user type has access to exactly the features and data required for their function, protecting sensitive business information while enabling efficient collaboration."""
story.append(Paragraph(roles_intro, body_style))
story.append(Spacer(1, 10))

# Roles table
roles_data = [
    [Paragraph('<b>User Role</b>', table_header_style), Paragraph('<b>Access Level</b>', table_header_style), Paragraph('<b>Primary Functions</b>', table_header_style)],
    [Paragraph('Administrator', table_cell_style), Paragraph('Full System Access', table_cell_style), Paragraph('Complete dashboard access, user management, carrier configuration, financial settings, system-wide reports, and audit logs', table_cell_style)],
    [Paragraph('Seller/Client', table_cell_style), Paragraph('Business Data Access', table_cell_style), Paragraph('Personal sales dashboard, individual stock levels, payout tracking, order history, and profit/loss statements for owned products', table_cell_style)],
    [Paragraph('Call Center Agent', table_cell_style), Paragraph('Order Operations', table_cell_style), Paragraph('Order confirmation interface, customer contact details, call attempt logging, and confirmation statistics (no financial data)', table_cell_style)],
    [Paragraph('Delivery Agent', table_cell_style), Paragraph('Mobile Field Access', table_cell_style), Paragraph('Daily delivery assignments, status updates, proof of delivery capture, cash collection tracking, and navigation tools', table_cell_style)]
]

roles_table = Table(roles_data, colWidths=[3*cm, 4*cm, 9*cm])
roles_table.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1F4E79')),
    ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
    ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
    ('BACKGROUND', (0, 1), (-1, 1), colors.white),
    ('BACKGROUND', (0, 2), (-1, 2), colors.HexColor('#F5F5F5')),
    ('BACKGROUND', (0, 3), (-1, 3), colors.white),
    ('BACKGROUND', (0, 4), (-1, 4), colors.HexColor('#F5F5F5')),
    ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#BDC3C7')),
    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ('LEFTPADDING', (0, 0), (-1, -1), 8),
    ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ('TOPPADDING', (0, 0), (-1, -1), 8),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
]))

story.append(roles_table)
story.append(Spacer(1, 20))

# ===== BUSINESS BENEFITS SECTION =====
story.append(Paragraph("4. Business Benefits", section_title_style))

benefits_intro = """Implementing this SaaS platform delivers measurable improvements across all aspects of COD fulfillment operations, from reduced error rates to improved cash flow visibility."""
story.append(Paragraph(benefits_intro, body_style))
story.append(Spacer(1, 10))

# Benefits
story.append(Paragraph("4.1 Operational Efficiency", subsection_title_style))
efficiency_benefits = [
    "Elimination of 90% of manual data entry errors between sales channels, spreadsheets, and carrier systems",
    "Reduction in order processing time from hours to minutes through automated workflows",
    "Instant access to order status without manual tracking across multiple carrier websites",
    "Standardized processes that reduce training time for new staff members"
]
for benefit in efficiency_benefits:
    story.append(Paragraph(f"• {benefit}", bullet_style))

story.append(Paragraph("4.2 Financial Control", subsection_title_style))
financial_benefits = [
    "Complete visibility into cash collected by delivery agents and pending remittances",
    "Accurate profit calculations that account for all operational costs",
    "Reduced losses from duplicate shipments and delivery errors",
    "Automated reconciliation between orders shipped and cash received"
]
for benefit in financial_benefits:
    story.append(Paragraph(f"• {benefit}", bullet_style))

story.append(Paragraph("4.3 Scalability", subsection_title_style))
scale_benefits = [
    "Handle thousands of daily orders without proportional increase in administrative staff",
    "Easy onboarding of new sellers, agents, and delivery personnel through self-service portals",
    "Cloud-based infrastructure that grows with business requirements",
    "Multi-currency and multi-language support for regional expansion"
]
for benefit in scale_benefits:
    story.append(Paragraph(f"• {benefit}", bullet_style))

story.append(Paragraph("4.4 Data Security &amp; Compliance", subsection_title_style))
security_benefits = [
    "Role-based access controls that protect sensitive profit and cost information",
    "Encrypted data transmission and storage meeting international security standards",
    "Automated daily backups ensuring business continuity",
    "Complete audit trails for all system actions and status changes"
]
for benefit in security_benefits:
    story.append(Paragraph(f"• {benefit}", bullet_style))

story.append(Spacer(1, 15))

# ===== INTEGRATION SECTION =====
story.append(Paragraph("5. Platform Integrations", section_title_style))

integration_intro = """The platform supports seamless integration with the most popular e-commerce platforms and business tools used in African and MENA markets, ensuring that existing workflows can be preserved while gaining the benefits of centralized management."""
story.append(Paragraph(integration_intro, body_style))
story.append(Spacer(1, 10))

# Integration table
integration_data = [
    [Paragraph('<b>Category</b>', table_header_style), Paragraph('<b>Platforms</b>', table_header_style), Paragraph('<b>Integration Method</b>', table_header_style)],
    [Paragraph('E-Commerce Stores', table_cell_style), Paragraph('Shopify, YouCan, Dropify', table_cell_style), Paragraph('Webhook-based real-time order synchronization', table_cell_style)],
    [Paragraph('Data Input', table_cell_style), Paragraph('Google Sheets, Excel, CSV', table_cell_style), Paragraph('Two-way sync with automatic validation', table_cell_style)],
    [Paragraph('Logistics Partners', table_cell_style), Paragraph('ColisSwift, Shipsen, AfriqueCod', table_cell_style), Paragraph('Direct API integration with status webhooks', table_cell_style)],
    [Paragraph('Payment Systems', table_cell_style), Paragraph('Mobile Money, Bank Transfer', table_cell_style), Paragraph('Reconciliation reports and payout tracking', table_cell_style)],
    [Paragraph('Communication', table_cell_style), Paragraph('SMS Gateways, Email', table_cell_style), Paragraph('Automated customer notifications', table_cell_style)]
]

integration_table = Table(integration_data, colWidths=[4*cm, 5*cm, 7*cm])
integration_table.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1F4E79')),
    ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
    ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
    ('BACKGROUND', (0, 1), (-1, 1), colors.white),
    ('BACKGROUND', (0, 2), (-1, 2), colors.HexColor('#F5F5F5')),
    ('BACKGROUND', (0, 3), (-1, 3), colors.white),
    ('BACKGROUND', (0, 4), (-1, 4), colors.HexColor('#F5F5F5')),
    ('BACKGROUND', (0, 5), (-1, 5), colors.white),
    ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#BDC3C7')),
    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ('LEFTPADDING', (0, 0), (-1, -1), 8),
    ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ('TOPPADDING', (0, 0), (-1, -1), 8),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
]))

story.append(integration_table)
story.append(Spacer(1, 20))

# ===== CONCLUSION SECTION =====
story.append(Paragraph("6. Next Steps", section_title_style))

conclusion_text = """This proposal outlines a comprehensive solution designed to transform COD fulfillment operations from manual, fragmented processes into an integrated, automated system. The platform addresses the specific challenges of the African and MENA markets while providing the scalability and security expected of enterprise-grade software."""
story.append(Paragraph(conclusion_text, body_style))

next_steps = """Upon approval, we propose the following implementation approach:"""
story.append(Paragraph(next_steps, body_style))

steps = [
    "<b>Discovery Phase:</b> Detailed requirements gathering and workflow analysis with key stakeholders",
    "<b>Configuration:</b> Platform setup including user roles, carrier integrations, and custom business rules",
    "<b>Training:</b> Comprehensive training sessions for administrators, agents, and delivery personnel",
    "<b>Pilot Launch:</b> Limited rollout to validate workflows and gather feedback",
    "<b>Full Deployment:</b> Complete platform activation with ongoing support and optimization"
]

for step in steps:
    story.append(Paragraph(f"• {step}", bullet_style))

story.append(Spacer(1, 20))

# Final contact section
contact_text = """We look forward to partnering with Gabon COD Platform to deliver a solution that drives operational excellence and business growth. Our team is available to discuss this proposal in detail and address any questions regarding features, implementation timeline, or pricing."""
story.append(Paragraph(contact_text, body_style))

# Build the PDF
doc.build(story)
print(f"PDF generated successfully at: {output_path}")
