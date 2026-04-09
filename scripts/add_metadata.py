#!/usr/bin/env python3
"""Add Z.ai metadata to PDF"""

from pypdf import PdfReader, PdfWriter
import os

pdf_path = "/home/z/my-project/download/Gabon_COD_Platform_Proposal.pdf"

# Read the PDF
reader = PdfReader(pdf_path)
writer = PdfWriter()

# Copy all pages
for page in reader.pages:
    writer.add_page(page)

# Add metadata
title = os.path.splitext(os.path.basename(pdf_path))[0]
writer.add_metadata({
    '/Title': title,
    '/Author': 'Z.ai',
    '/Creator': 'Z.ai',
    '/Subject': 'Professional SaaS COD Fulfillment Platform Proposal for Gabon COD Platform'
})

# Write the PDF
with open(pdf_path, "wb") as output:
    writer.write(output)

print(f"Metadata added to {pdf_path}")
