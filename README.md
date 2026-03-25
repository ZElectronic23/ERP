Z.Electronic ERP

Enterprise ERP System built with Next.js 14 (App Router) + Supabase PostgreSQL.

Overview

Z.Electronic ERP is a modular enterprise management system covering:

Projects Management

Accounting & Invoices

HR & Employees

Partners (Financial / Technical)

Products & Inventory

Tasks & Workflow

Notifications

Audit Trail

Soft Delete System

Role-Based Access Control (RBAC)

Multi-language Support (Arabic / English)

The system is designed with production-grade architecture, strict security policies, and full traceability.

Technology Stack

Frontend:

Next.js 14 (App Router)

React

Tailwind CSS

Backend:

Supabase (PostgreSQL)

Supabase Auth

Row Level Security (RLS)

Optional Integrations:

OpenRouter AI

WhatsApp integration

Chart libraries for analytics

Core Architectural Principles

Modular folder structure

Strict separation between UI and API

Centralized authentication

Role-based permissions

Soft delete instead of hard delete

Full audit logging

Multi-language via URL params

Secure environment variable management

Database Architecture

The system uses PostgreSQL with the following core entities:

Business Core:

clients

projects

invoices

invoice_items

offer

offer_details

products

services

vendors

Human Resources:

employees

roles

permissions

evaluation

employee_requests

Financial & Operations:

expenses

profit_details

follow_up

tasks

Governance & Logging:

audit_logs

notifications

data_snapshots

All primary business tables support:

created_at

updated_at

deleted_at (Soft Delete)

Soft Delete System

Records are never permanently removed by default.

Soft Delete:

Sets deleted_at timestamp

Records action in audit_logs

Restore:

Clears deleted_at

Logged in audit trail

Permanent Delete:

Restricted to administrators

Logged before execution

Audit System

Every critical operation is recorded in:

audit_logs

Includes:

Table name

Record ID

Action type

Old data (JSON)

New data (JSON)

User ID

Timestamp

This ensures full traceability and compliance readiness.

Authentication & Authorization

Supabase Auth

Custom roles table

permissions mapping

Role-based access enforcement in:

API routes

Server components

RLS policies

Users table supports:

role_key

view_access

edit_access

language preference

Multi-Language Support

Language is detected via URL parameter:

/[locale]/

Supported:

ar (default)

en

All UI text passes through translation utility.

Dashboard Features

Includes:

Revenue charts

Project status analytics

Expense tracking

Inventory health indicators

Task timelines

KPI metrics

Financial summaries

Environment Configuration

Required environment variables:

NEXT_PUBLIC_SUPABASE_URL

NEXT_PUBLIC_SUPABASE_ANON_KEY

SUPABASE_SERVICE_ROLE_KEY

OPENROUTER_API_KEY

Important:
Environment files must never be committed to GitHub.

Project Structure

app/[locale]/
components/
lib/
api/

Each module follows consistent internal structure:

page.tsx

CRUD routes

RLS enforcement

Soft delete integration

Deployment

Recommended flow:

Install dependencies

Configure environment variables

Run database schema in Supabase

npm run dev (local)

Deploy via Vercel

Enable RLS policies

Security Model

Row Level Security enabled

Soft delete enforced in queries

Audit logging mandatory

Service role key used only in server context

Public key used only in client-safe operations

This system is designed for enterprise-scale deployment and long-term extensibility.