# InsureFlow

Requirement:-

Hi Jitendra and Aman,

As part of your training, I'm assigning you an enterprise-level project. You'll work on it together, and each of you will own one module. Please read the details below carefully.

Deadline: Friday, 27 November 2026, end of day

PROJECT: InsureFlow – Insurance Enrollment & Servicing Platform

Stack: Java (Spring Boot) for the backend, React for the frontend, PostgreSQL for the database, hosted on AWS.

AI usage: You can use AI for development and testing, but you must be able to explain every part of the code you submit.

PROBLEM STATEMENT

A bank partners with an insurance company to offer Accidental Death & Dismemberment (AD&D) cover to its customers. The bank mails marketing offers to customers, and each offer carries a unique campaign code. Customers use this code to enroll online, choose a cover amount, and pay a monthly premium. After enrolling, they should be able to view and manage their policy and raise a claim. The operations team needs to create campaigns, run monthly billing, process claims, and see how campaigns are performing.
Build InsureFlow, a web application that supports this full flow: campaign, enrollment, billing and claims.

MODULE OWNERSHIP
Jitendra – Enrollment & Policy (customer side)
A customer enrolls using a campaign code, picks a cover amount ($10,000 to $300,000 in $5,000 steps), and adds beneficiaries.
Business rules: age 18 to 69, no duplicate enrollment for the same product, and premium = $0.60 per $1,000 of cover per month.
Generate a policy number and a downloadable PDF certificate.
A customer can view their policy and update their address or beneficiaries, with every change saved in an audit history.
A customer can cancel their policy and gets a cancellation confirmation.
Aman – Campaign, Billing & Claims (operations side)
An admin creates a client (bank), a campaign and its events, and the system generates the campaign codes.
A monthly billing job creates premium records for all active policies. Failed payments are flagged for retry.
Customers submit claims with supporting documents (stored in S3), and an admin moves each claim through Submitted, Under Review, Approved or Rejected.
An operations dashboard shows enrollments per campaign, response rate, active policies and open claims.
Shared by both
Login with roles (Customer, Admin, Operations) using Spring Security and JWT.
Database design, API documentation (OpenAPI/Swagger), the CI/CD pipeline and the AWS setup.
DELIVERABLES
User stories in Jira for your own module, with acceptance criteria in Given/When/Then format, story points and priority.
A short design document: architecture diagram, ER diagram and API contract. Agree this between you before you start coding.
Source code in Git, using feature branches. Every change goes through a pull request reviewed by the other person. No direct commits to the main branch.
Testing: JUnit unit tests for the business logic, and Playwright end-to-end tests for the main flows of your module.
Deployment on AWS with a working URL (backend on ECS or Elastic Beanstalk, database on RDS, React on S3 + CloudFront), deployed through a GitHub Actions pipeline.
A live demo and viva, where you walk through the full flow and answer questions on your code and design decisions.
EVALUATION
You'll be evaluated individually on your own module and jointly on the shared parts:
User stories and requirement understanding: 15%
Code quality and design: 20%
Testing (JUnit and Playwright): 20%
AWS deployment and CI/CD: 15%
Git and PR discipline, teamwork: 10%
Demo and viva: 20%
