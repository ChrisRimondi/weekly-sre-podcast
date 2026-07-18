# Weekly SRE - 2026-07-18

## Intro

Hello and welcome to the Weekly SRE podcast for July 18, 2026. I'm your host, and today we'll delve into the latest developments in site reliability engineering. We'll cover recent incidents and postmortems, platform and cloud updates, advancements in observability and tooling, and practical lessons for SRE professionals. Let's get started.

## Highlights

This week, several significant events have shaped the reliability engineering landscape:

- **Lakeside Software** introduced SysTrack Reliability Engineering, applying SRE principles to end-user computing.
- **FERC** mandated new reliability standards for data centers and computational loads.
- **Deployable Energy** achieved a milestone with its Unity demonstration reactor reaching criticality.
- **Cloudflare** released a study highlighting the persistent fragility of global internet infrastructure.

We'll explore these topics in detail, along with other notable incidents and updates.

## Incidents and Postmortems

### Internet Outages in Georgetown, Texas

On July 15, 2026, vandals damaged fiber cables in Georgetown, Texas, disrupting internet services for approximately 20,000 Optimum customers. This incident underscores the vulnerability of physical infrastructure to intentional damage and the cascading effects on service reliability. ([datacenterdynamics.com](https://www.datacenterdynamics.com/en/topics-and-tech/security-and-risk/outages/?utm_source=openai))

**Reliability Lesson:** Protecting physical infrastructure is as crucial as securing digital assets. Implementing robust monitoring and rapid response strategies can mitigate the impact of such incidents.

### MTN Uganda Data Center Power Disruption

On July 8, 2026, MTN Uganda experienced a significant outage due to a power disruption at one of its data centers. The incident affected a substantial portion of their customer base, highlighting the critical importance of power reliability in data center operations. ([datacenterdynamics.com](https://www.datacenterdynamics.com/en/topics-and-tech/security-and-risk/outages/?utm_source=openai))

**Reliability Lesson:** Ensuring redundant power supplies and conducting regular testing of backup systems are essential to maintain service continuity.

### Telstra's Major Network Outage

Australia's Telstra faced a major network outage on July 8, 2026, attributed to software defects. This disruption affected numerous customers and services, emphasizing the need for rigorous software testing and deployment practices. ([datacenterdynamics.com](https://www.datacenterdynamics.com/en/topics-and-tech/security-and-risk/outages/?utm_source=openai))

**Reliability Lesson:** Implementing comprehensive testing protocols and gradual rollout strategies can help identify and mitigate software issues before they impact users.

## Platform/Cloud Updates

### SysTrack Reliability Engineering by Lakeside Software

On June 25, 2026, Lakeside Software launched SysTrack Reliability Engineering, an evolution of their SysTrack platform that applies SRE principles to end-user computing. This tool introduces a service level objective (SLO)-driven model for managing employee experience as a measurable IT service. ([lakesidesoftware.com](https://www.lakesidesoftware.com/news/lakeside-software-launches-systrack-reliability-engineering-to-transform-digital-employee-experience/?utm_source=openai))

**Reliability Lesson:** Extending SRE practices to end-user computing can bridge the gap between infrastructure health and user experience, ensuring that IT services align with business outcomes.

### FERC's New Reliability Standards for Data Centers

The Federal Energy Regulatory Commission (FERC) issued an order on July 16, 2026, directing the North American Electric Reliability Corporation (NERC) to develop mandatory reliability standards for data centers and other computational loads. This move aims to integrate these entities into the mandatory reliability framework, recognizing their critical role in the power grid. ([powermag.com](https://www.powermag.com/ferc-orders-mandatory-nerc-reliability-standards-for-data-center-and-other-computational-loads/?utm_source=openai))

**Reliability Lesson:** As data centers become integral to infrastructure, adhering to standardized reliability practices is essential to ensure grid stability and service continuity.

### Deployable Energy's Unity Reactor Achieves Criticality

Deployable Energy announced on July 1, 2026, that its Unity demonstration reactor achieved initial criticality at the Idaho National Laboratory. This milestone validates the reactor design and underscores the focus on rapid development and deployment of new energy technologies. ([prnewswire.com](https://www.prnewswire.com/news-releases/deployable-energy-announces-unity-demonstration-reactor-achieves-criticality-at-idaho-national-laboratory-302816255.html?utm_source=openai))

**Reliability Lesson:** Rapid innovation in energy technologies requires rigorous testing and validation to ensure safety and reliability in deployment.

## Observability and Tooling

### Cloudflare's Study on Internet Infrastructure Fragility

Cloudflare's Q3 Internet Disruptions report, published eight months ago, revealed the persistent fragility of global internet infrastructure. The study identified government-imposed shutdowns, accidental cable damage, cyberattacks, and natural disasters as primary causes of outages. ([techradar.com](https://www.techradar.com/pro/disasters-shutdowns-and-cable-damage-galore-cloudflare-study-reveals-whats-really-been-behind-all-the-recent-internet-outages?utm_source=openai))

**Reliability Lesson:** Understanding the diverse causes of internet disruptions is crucial for developing resilient systems. Implementing comprehensive monitoring and incident response plans can mitigate the impact of such events.

### The SRE Report 2026 by LogicMonitor

LogicMonitor released "The SRE Report 2026," highlighting key trends in site reliability engineering. Notably, 49% of respondents reported that AI adoption has decreased toil, and 17% of organizations regularly run chaos or resilience engineering experiments in production. ([logicmonitor.com](https://www.logicmonitor.com/resources/2026-observability-ai-trends-outlook-2?utm_source=openai))

**Reliability Lesson:** Leveraging AI to reduce manual toil and embracing chaos engineering practices can enhance system resilience and reliability.

## Practical Takeaways

1. **Protect Physical Infrastructure:** Implement security measures and monitoring to safeguard against intentional damage to physical assets.

2. **Ensure Power Redundancy:** Regularly test backup power systems to prevent outages due to power disruptions.

3. **Adopt Rigorous Software Testing:** Utilize comprehensive testing protocols to identify and address software defects before deployment.

4. **Extend SRE Practices to End-User Computing:** Align IT services with business outcomes by managing employee experience through SLOs.

5. **Integrate Data Centers into Reliability Frameworks:** Adhere to standardized reliability practices to ensure grid stability and service continuity.

6. **Embrace AI and Chaos Engineering:** Use AI to reduce manual toil and conduct regular chaos engineering experiments to enhance system resilience.

## Watchlist for Next Week

- **Mid-Atlantic Grid Stability:** Monitoring the impact of the Department of Energy's emergency order to stabilize the Mid-Atlantic grid amid forecasted hot weather conditions. ([energy.gov](https://www.energy.gov/articles/energy-secretary-secures-mid-atlantic-grid-ahead-period-hot-weather-0?utm_source=openai))

- **Utility Outages Due to Heat and Storms:** Observing the performance of utilities during ongoing heatwaves and storms, as noted by Jefferies in early July. ([investing.com](https://www.investing.com/news/stock-market-news/jefferies-notes-utility-outages-during-july-heat-and-storms-93CH-4777167?utm_source=openai))

- **Advancements in AI Reliability Frameworks:** Keeping an eye on developments in integrating reliability and resilience engineering principles into AI systems to enhance trustworthiness. ([arxiv.org](https://arxiv.org/abs/2411.08981?utm_source=openai))

## Sources

- [Lakeside Software Launches SysTrack Reliability Engineering](https://www.lakesidesoftware.com/news/lakeside-software-launches-systrack-reliability-engineering-to-transform-digital-employee-experience/)

- [FERC Orders Mandatory NERC Reliability Standards for Data Center and Other Computational Loads](https://www.powermag.com/ferc-orders-mandatory-nerc-reliability-standards-for-data-center-and-other-computational-loads/)

- [Deployable Energy Announces Unity Demonstration Reactor Achieves Criticality at Idaho National Laboratory](https://www.prnewswire.com/news-releases/deployable-energy-announces-unity-demonstration-reactor-achieves-criticality-at-idaho-national-laboratory-302816255.html)

- [Cloudflare Study Reve
