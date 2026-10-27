# VoxGarden: Product Requirements Document (PRD) and MVP

- **Document version:** 1.0
- **Product stage:** Concept and MVP planning
- **Product category:** SaaS · Internet Radio · Audio Creation · Media Discovery
- **Founding partners:** Ayobami, Bamidele and Motunrayo
- **Working principle:** We rise by lifting others.
- **Brand tagline:** Every voice deserves room to grow.

> Status: draft v1.0, not yet signed off by all three founders. Review notes and proposed changes are in [PRD-REVIEW.md](PRD-REVIEW.md).

---

## 1. Executive Summary

VoxGarden is a mobile-first audio creation, internet radio broadcasting and discovery platform designed to make broadcasting accessible to people who lack expensive equipment, computers, technical expertise or access to traditional media organisations.

The platform will allow individuals, independent broadcasters, schools, universities and communities to create audio programmes, operate internet radio stations and reach audiences through a connected global discovery network.

VoxGarden will consist of four integrated products:

1. **VoxGarden Create:** Mobile audio recording, editing and programme production.
2. **VoxGarden Studio:** Radio station creation, management, scheduling and live broadcasting.
3. **VoxGarden Audio Infrastructure:** The streaming, storage, automation and audio-processing systems powering the platform.
4. **VoxGarden Globe:** A geographical discovery and listening platform inspired by the exploration experience of Radio Garden.

All four products will share a common account system, station identity, media library and permissions framework.

The first release will prioritise a simple end-to-end workflow over a large collection of features.

A user should be able to record audio on a smartphone, make basic edits, publish the finished recording to a station, schedule its broadcast and share a listening link.

### 1.1 Mission

To make broadcasting affordable and accessible by giving people the tools and infrastructure to create, distribute and grow their own audio platforms.

### 1.2 Vision

A connected network of independent voices where anyone can start small, develop an audience and grow into a professional broadcaster without first needing institutional approval or significant capital.

### 1.3 Business model

VoxGarden will operate as a subscription-based software and managed audio infrastructure business, supported by a free entry tier, paid subscriptions, institutional packages and future monetisation services.

---

## 2. The Problem

Traditional broadcasting can require substantial investment in studios, equipment, transmission infrastructure, staff and operations.

Internet radio lowers some of these barriers, but aspiring broadcasters still face several challenges.

### 2.1 Financial barriers
Many aspiring broadcasters cannot afford a computer, microphone, audio editing software, hosting, streaming services or professional production support.

### 2.2 Technical barriers
Existing broadcasting tools can require users to understand stream URLs, passwords, encoders, server configurations, audio formats and integrations. These requirements discourage people whose strengths are journalism, presentation, storytelling, music, education or community engagement.

### 2.3 Limited access to production tools
People who only own smartphones may struggle to record, edit and publish complete audio programmes using a single, accessible workflow.

### 2.4 Limited distribution
Independent broadcasters can create content but struggle to attract listeners beyond their existing social networks.

### 2.5 Institutional restrictions
Talented presenters working within established organisations may have limited freedom to develop independent programmes or experiment with niche audiences.

### 2.6 Educational limitations
Schools and universities need accessible ways to provide practical broadcasting, journalism, communication and media-production experience without establishing expensive conventional radio facilities.

---

## 3. Target Users

### Primary users

- **A. Independent broadcasters:** People who want to launch a station, develop a niche and build an independent media business.
- **B. Smartphone-first creators:** People who want to produce podcasts, commentary, interviews, educational content or radio programmes without owning a computer.
- **C. Schools and universities:** Institutions that want students to gain practical broadcasting and media-production experience.
- **D. Community broadcasters:** Local organisations and community groups that want to distribute information, culture, news and educational content.

### Secondary users

- Professional radio presenters and producers.
- Podcast creators.
- Small media companies.
- Religious and cultural organisations.
- Specialist broadcasters covering sports, technology, business, entertainment and education.
- Listeners looking for stations around the world.

---

## 4. Product Architecture

### Product 1: VoxGarden Create
**Purpose:** Enable users to record, edit, produce and publish audio from a smartphone.

Core capabilities:
- Record voice and interviews.
- Import audio files.
- Trim, split and rearrange clips.
- Adjust clip volume and fade audio.
- Combine voice recordings and permitted background audio.
- Add intros, outros and jingles.
- Save drafts and resume editing.
- Export finished audio.
- Publish finished recordings to VoxGarden Studio.
- Create programme titles and descriptions.

Future capabilities include AI transcription, noise reduction, show notes, translations and automated promotional content.

### Product 2: VoxGarden Studio
**Purpose:** Allow users to create and operate internet radio stations without technical configuration.

Core capabilities:
- Create and customise a station.
- Upload logos and station information.
- Manage a media library.
- Create playlists and schedules.
- Automate playback through AutoDJ.
- Broadcast live using a supported browser-based interface.
- Invite presenters and assign permissions.
- View station health and basic listener statistics.
- Generate public station pages and shareable links.

### Product 3: VoxGarden Audio Infrastructure
**Purpose:** Provide the technical systems that power recording uploads, scheduled playback, live broadcasting and audio delivery.

Core capabilities:
- Station provisioning.
- Audio storage and processing.
- Live audio ingestion.
- Automated playback.
- Stream distribution.
- Station and stream monitoring.
- Authentication and access control.
- Backups and recovery.
- Usage metering and infrastructure cost tracking.

Initial implementation should evaluate AzuraCast, Liquidsoap and Icecast rather than rebuilding proven broadcasting infrastructure from scratch.

VoxGarden will provide its own application layer and user experience. All third-party software must be integrated in accordance with its licensing terms.

### Product 4: VoxGarden Globe
**Purpose:** Help listeners discover and listen to stations through an interactive geographical interface.

Core capabilities:
- Interactive globe or map.
- Search by station, location, genre and language.
- Public station profiles.
- Live audio playback.
- Recently played stations.
- Favourite stations.
- Station categories and featured listings.
- Links to programme pages.

The MVP can begin with a searchable directory and a simplified map. A polished 3D globe can follow after the broadcasting workflow is reliable.

---

## 5. MVP Definition

The MVP is not four complete applications. It is the smallest integrated system that demonstrates the business model and solves the primary user problem.

**MVP objective:** Enable a first-time broadcaster to create and publish an audio programme from a smartphone, connect it to an internet radio station and share it with listeners.

### 5.1 MVP feature scope

**VoxGarden Create**
- Mobile-responsive recording interface.
- Microphone permission handling.
- Record, pause, resume and stop.
- Basic trimming and clip arrangement.
- Save draft locally or to supported cloud storage.
- Export finished audio.
- Publish audio directly to the user's station library.
- Basic project and upload status.

**VoxGarden Studio**
- Account creation and login.
- Station creation wizard.
- Station name, description, category, language and logo.
- Automatic station provisioning.
- Audio upload and media library.
- Basic playlists and scheduling.
- AutoDJ playback.
- Supported browser-based live broadcasting.
- Public station player.
- Basic station status indicators.

**VoxGarden Audio Infrastructure**
- Initial integration with the selected radio engine.
- Automated station creation through a secure backend.
- Stream URLs and credentials managed behind the scenes.
- Audio upload and processing.
- Scheduled playback.
- Stream health checks.
- Basic error logging and alerts.
- Usage limits to control infrastructure costs.

**VoxGarden Globe**
- Searchable station directory.
- Public station pages.
- Live audio playback.
- Categories and location filters.
- Basic map-based station discovery.
- Direct sharing of station links.

**Shared platform**
- Single user account.
- Station ownership and permissions.
- Common media library references.
- Secure application-to-infrastructure communication.
- Basic administration dashboard.
- Account and station management.
- Usage tracking.

---

## 6. Features Excluded From the First MVP

To avoid wasting development time and money, the following features will not be required for the first release:

- A fully featured native iOS and Android application.
- Advanced multitrack digital audio workstation.
- AI voice cloning.
- AI-generated presenters.
- Automatic music licensing.
- Advertising marketplace.
- Revenue-sharing automation.
- Advanced monetisation analytics.
- Multiple broadcasting servers across regions.
- Complex enterprise integrations.
- Full social networking features.
- Unlimited streaming plans.
- Sophisticated 3D globe animations.

These features can be considered after the first release proves demand, usability and operating economics.

---

## 7. Core User Journey

### Journey A: Create and publish a programme
1. The user creates a VoxGarden account.
2. The user creates a station or joins an existing one.
3. The user opens VoxGarden Create on a smartphone.
4. The user records an audio programme.
5. The user edits the recording and saves the project.
6. The user exports or publishes the audio.
7. VoxGarden transfers the finished audio into the station's media library.
8. The user chooses whether to publish it as a podcast, schedule it or add it to a playlist.
9. The station plays the recording at the scheduled time.
10. The user shares the station link.
11. Listeners open the link and hear the broadcast.

**Success condition:** The user completes this workflow without manually configuring a streaming server or copying technical credentials.

### Journey B: Launch a live broadcast
1. The user opens VoxGarden Studio.
2. The user selects their station.
3. The user opens the live broadcasting interface.
4. The browser requests microphone permission.
5. The user selects an available audio input.
6. The user presses Go Live.
7. The system establishes the live audio connection.
8. The station indicates that the presenter is live.
9. Listeners hear the broadcast through the public player.
10. The presenter ends the broadcast and receives a clear connection status.

The system must handle microphone denial, interrupted connections, failed uploads and stream disconnections with understandable error messages.

### Journey C: Discover a station
1. A listener opens VoxGarden Globe.
2. The listener searches for a station or explores a location.
3. The listener selects a station.
4. The station profile and player open.
5. Playback begins when requested.
6. The listener can favourite or share the station.

---

## 8. Functional Requirements

| ID | Requirement | Priority |
|---|---|---|
| FR-01 | Users can create and authenticate accounts | Must |
| FR-02 | Users can create stations through a guided wizard | Must |
| FR-03 | Station provisioning is automated by the backend | Must |
| FR-04 | Users can record audio on supported smartphones | Must |
| FR-05 | Users can perform basic audio edits | Must |
| FR-06 | Users can upload and organise audio | Must |
| FR-07 | Create can publish audio into Studio | Must |
| FR-08 | Stations support scheduled playback | Must |
| FR-09 | Stations support live broadcasting | Must |
| FR-10 | Each published station has a public player | Must |
| FR-11 | Listeners can search and discover stations | Must |
| FR-12 | Administrators can monitor station health | Must |
| FR-13 | System tracks resource consumption | Must |
| FR-14 | Users can manage collaborators and permissions | Should |
| FR-15 | Users can view basic audience analytics | Should |
| FR-16 | Users can save favourite stations | Should |
| FR-17 | Users can access AI production tools | Later |
| FR-18 | Stations can monetise through integrated advertising | Later |

---

## 9. Non-Functional Requirements

**Performance**
- The interface should remain usable on entry-level smartphones.
- Recording controls must respond promptly.
- Uploads must show progress and recover gracefully from supported interruptions.
- Audio playback should start promptly under suitable network conditions.
- Large media files must not require loading the entire file into browser memory.

**Reliability**
- Station status must reflect actual infrastructure health.
- Scheduled programmes must play within a defined scheduling tolerance.
- Failed operations must be logged and retried where safe.
- Backups and recovery procedures must be documented and tested.

**Security**
- API credentials and administrative secrets must remain on the backend.
- Users must only access stations and media they are authorised to use.
- Authentication and permissions must be enforced server-side.
- Uploads must be validated and protected against malicious files.
- Rate limits and resource quotas must prevent abuse.

**Accessibility**
- Interfaces should use clear labels, readable text and accessible controls.
- Essential workflows should work on mobile screens.
- Error messages must explain what happened and how to recover.

**Connectivity**
- Basic recording and editing should work locally where supported.
- Cloud publishing, remote station management and live broadcasting require internet access.
- Interrupted uploads should resume where the implementation supports it.

**Cost control**
- Streaming consumption, storage and processing must be measured.
- Free-tier limits must be enforceable.
- The platform must support per-station usage reporting.

---

## 10. Recommended Technical Architecture

**Client applications.** Start with a responsive web application or progressive web app for Create, Studio and Globe. Evaluate native mobile development later if browser limitations prevent reliable recording, background operation or other essential workflows.

**Backend.** Build a central application backend responsible for: user accounts and authentication; station ownership and permissions; station provisioning; subscription and usage management; media metadata; secure communication with the radio engine; discovery directory; monitoring and administration.

**Database.** Use a relational database such as PostgreSQL for accounts, stations, permissions, subscriptions, schedules and media metadata. Store uploaded audio in suitable object storage rather than directly in the relational database.

**Audio engine.** Evaluate AzuraCast as the initial station management and automation layer, with its underlying Liquidsoap and Icecast components where appropriate. Verify the supported APIs, live input methods, provisioning workflows, deployment requirements and software licences before finalising the integration.

**Media processing.** Use a suitable audio-processing service or library for file validation, transcoding, waveform generation and other required transformations. Processing should occur asynchronously when necessary so a large upload does not block the application interface.

**Integration model.** All communication between the application and the audio engine should pass through a controlled backend integration layer. The mobile client must not receive privileged infrastructure credentials. The Create-to-Studio workflow should use authenticated media references and processing status rather than exposing internal storage paths or server settings.

---

## 11. Suggested Development Phases

**Phase 1: Technical proof of concept.** Deploy the initial radio engine. Create a test station. Verify automated playback. Test live broadcasting. Publish a working public player. Measure streaming and hosting costs.
*Deliverable:* One reliable station that can broadcast live and play scheduled audio.

**Phase 2: Station management MVP.** Build authentication and station onboarding. Integrate automatic provisioning. Create the media library. Implement scheduling and AutoDJ controls. Publish station pages.
*Deliverable:* Users can create and operate a station through VoxGarden Studio.

**Phase 3: VoxGarden Create MVP.** Build smartphone recording. Implement basic trimming and editing. Add saving and export. Connect audio publishing to Studio. Test on representative low-cost Android devices.
*Deliverable:* A user can create and publish a programme using only a supported smartphone and the internet where required.

**Phase 4: VoxGarden Globe MVP.** Build station search and categories. Implement the public player. Add geographical station discovery. Connect published stations to the directory.
*Deliverable:* Listeners can discover and listen to stations.

**Phase 5: Pilot and commercial validation.** Recruit independent broadcasters. Pilot with a school or university. Track successful onboarding, uptime and listening activity. Interview users about pricing and usability. Adjust resource limits and subscriptions based on real operating costs.
*Deliverable:* Evidence that customers can use the product and that the operating model can become sustainable.

---

## 12. MVP Success Metrics

The first release should be judged by actual usage rather than the number of features shipped.

| Metric | Initial target |
|---|---|
| New users completing station setup | At least 80% of pilot users |
| First programme successfully published | At least 70% of users who begin creation |
| First broadcast completed without technical assistance | At least 80% of pilot broadcasters |
| Station provisioning success | At least 98% of attempts |
| Critical stream availability | Target 99.5% during the pilot, measured and reported |
| Pilot users returning within 30 days | At least 40% |
| Unassisted onboarding | Most pilot users complete setup without developer intervention |
| Unit economics | Streaming and storage costs measured per station and listener-hour |

These are proposed validation targets, not guaranteed performance levels. The pilot will establish realistic baselines and reveal which targets need adjustment.

---

## 13. Risks and Mitigation

- **Infrastructure costs exceed revenue.** Apply usage limits, measure listener-hours, separate storage from streaming costs and test pricing before scaling.
- **Users struggle with live broadcasting.** Begin with a tested browser-based broadcasting path, provide clear connection status and document supported devices.
- **Mobile editing is unreliable on low-end devices.** Test early on lower-spec Android phones, use local processing where practical and avoid memory-intensive editing designs.
- **The audio engine is difficult to integrate.** Build a technical proof of concept before committing to a full custom application. Keep the integration layer modular.
- **Music licensing creates legal exposure.** Establish policies for copyrighted music, user uploads and commercial broadcasts. Verify applicable Nigerian and international licensing obligations.
- **Free users consume excessive resources.** Enforce transparent usage quotas and fair-use limits. Do not promise unlimited broadcasting on an unsustainable free plan.
- **The founders disagree about ownership or responsibilities.** Execute a founders' agreement covering ownership, contributions, intellectual property, decision-making, expenses and exit procedures before significant development spending.

---

## 14. Partnership and Governance

VoxGarden is being developed as a partnership involving Ayobami, Bamidele and Motunrayo. The founders should agree on responsibilities based on their skills, availability and contributions.

Before commercial launch, document:
- Equity ownership and vesting arrangements, if applicable.
- Founder responsibilities and decision rights.
- Intellectual property ownership.
- Financial contributions and expense approvals.
- Salary and profit distribution policies.
- Dispute resolution.
- Departure and share-transfer procedures.

The company's commitment to accessible broadcasting should also be reflected in pricing, customer support, educational partnerships and fair treatment of creators.

---

## 15. Definition of MVP Completion

The MVP is ready for pilot use when all of the following are true:

- [ ] A new user can create an account.
- [ ] The user can create a station without manually configuring the audio engine.
- [ ] The user can record audio on a supported smartphone.
- [ ] The user can edit and export a basic programme.
- [ ] The user can publish the programme to their station library.
- [ ] The user can schedule the programme for automated playback.
- [ ] The user can initiate a live broadcast through the supported interface.
- [ ] The station has a working public player.
- [ ] A listener can discover the station through the directory.
- [ ] The system reports meaningful errors and station health.
- [ ] Administrative credentials remain protected.
- [ ] Usage is measured sufficiently to estimate operating costs.
- [ ] Pilot users can complete the core workflow without developer assistance.

---

## 16. Final Product Principle

VoxGarden must not become another technical platform that claims to empower people but requires them to hire an engineer before they can use it.

The technology should be powerful behind the scenes and simple in the user's hands.

Someone should be able to begin with a smartphone, record a meaningful programme, publish it and reach listeners without first purchasing a studio or mastering complicated software.

VoxGarden exists to make the first step into broadcasting smaller, the path to growth clearer, and the opportunity available to more people.

**We rise by lifting others.**
