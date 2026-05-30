# Weekly SRE Briefing - May 30, 2026

This episode is AI-generated and based only on public sources.

## Intro

Welcome to the Weekly SRE Briefing for Saturday, May 30, 2026.

This week's theme is the reliability of the systems that decide whether other systems are allowed to work.

That sounds abstract, but the pattern is very concrete. A build cannot start because an account review system disabled the service account behind the workflow. A GitHub App cannot authenticate because a cache proxy upgrade changed token behavior. A dashboard cannot answer incident questions because the analytics API is degraded at the exact moment operators need it. A remote operations platform still has safe local control functions, but degraded network throughput turns live video into a bad control surface. None of these stories are simply "the server went down." They are stories about control planes, identity planes, observability planes, and automation planes.

The practical SRE lesson is that reliability is increasingly determined by the correctness of policy and coordination systems. The blast radius of a bad health check, a confused account suspension workflow, a stale cache, or a noisy telemetry pipeline can be just as real as the blast radius of failed hardware.

This week we will start with highlights, then spend time on the public incidents and post-incident material that give us the strongest learning signal: GitHub Actions and Pages, GitHub App token authentication, Cloudflare analytics and edge status items, and Skydio's review of degraded connectivity for remote flight operations. Then we will move into AWS resilience updates, Kubernetes 1.36 reliability changes, and observability tooling, where OpenTelemetry's graduation is the headline but not the whole story.

As always, the goal is not to turn status pages into gossip. The goal is to pull out durable operating lessons: how to design service identity safeguards, keep health checks from causing cascading failure, use telemetry when telemetry itself is degraded, and test resilience before production writes the test for you.

## Highlights

Highlight one: GitHub published a May 26 incident update for Actions and Pages where an automated account review system incorrectly suspended the service account used by GitHub Actions to authenticate workflow runs and download actions. GitHub restored the account, marked it exempt from further automated review, redeployed a related service to flush cached account state, and added allowlisting for service accounts that should not be suspendable by automated systems. The SRE takeaway is direct: service identities need stronger guardrails than ordinary user identities, and cached authorization state can extend the incident after the immediate cause has been corrected.

Highlight two: GitHub's May 23 app installation token incident had a different cause but a related reliability shape. Between 06:00 and 19:12 UTC, a fraction of app installation token authentication requests failed. GitHub attributed the issue to a caching proxy component and rolled that component back. For platform teams, this is a reminder that authentication reliability depends on caches, dependency upgrades, and fallback behavior, not only on the identity provider itself.

Highlight three: Cloudflare's public status history this week included degraded Cloudflare Analytics availability on May 27 and a resolved container registry availability issue. Cloudflare also had many datacenter maintenance events where traffic could be rerouted and private or cloud network interconnect customers were asked to expect failover. There is a good operational lesson there: planned maintenance should be treated as a real failover exercise, especially when private connectivity is involved.

Highlight four: Skydio published a post-incident review for degraded connectivity on May 6 and 7. The summary says affected flights saw poor video performance and high latency, with some throughput dropping to about 0.5 Mbps compared with a typical 3 to 5 Mbps. Importantly, Skydio separated the customer-facing symptom from safety-critical local functions that were not affected. That distinction is one every SRE should practice: identify the degraded control surface without overstating which safety functions failed.

Highlight five: AWS announced an expanded Resilience Hub experience aimed at SRE and development teams, including dependency discovery assessment, generative AI-assisted failure mode analysis, modular resilience policies, and organization-wide reporting. AWS also published a Honeycomb example around AWS Fault Injection Service. The interesting point is not the marketing label; it is the direction of travel. Resilience programs are moving from static architecture review toward continuous policy, dependency discovery, and tested failure modes.

Highlight six: Kubernetes 1.36 continues to ship reliability-relevant primitives: PSI metrics are now GA, Mixed Version Proxy is beta and enabled by default, volume group snapshots reached GA, fine-grained kubelet API authorization is GA, and new workload-aware scheduling APIs are evolving for batch and AI workloads. The pattern is clear: the project is investing in safer upgrades, better saturation signals, better recovery primitives, and better scheduling behavior for large coordinated workloads.

Highlight seven: OpenTelemetry graduated in the CNCF on May 21, and the follow-on ecosystem conversation is shifting from "should we adopt OTel?" to "how do we operate OTel well?" That means pipeline ownership, semantic convention discipline, sampling policy, cost control, and reference architectures are now first-class reliability topics.

## Incidents and Postmortems

### GitHub Actions and Pages: service identities need blast-radius controls

The most SRE-dense public incident note this week came from GitHub's status page for May 26.

GitHub reported degraded performance for Actions and Pages beginning around 10:57 UTC. By 11:53 UTC, the status page said authentication issues were causing failures when starting Actions runs and downloading actions, with the majority of Actions runs impacted. GitHub later identified the cause and restored service, and the post-incident update is unusually useful because it names the mechanism plainly.

The cause was an automated account review system incorrectly suspending the service account used by GitHub Actions to authenticate workflow runs and download actions. GitHub restored the account at 12:16 UTC, marked it exempt from further automated review at 12:20 UTC, and redeployed a related service at 12:48 UTC to flush cached account state. Full recovery was confirmed at 12:56 UTC. GitHub also noted that a small number of Issues, pull requests, comments, and discussions were marked as hidden when the service account was disabled; no data was lost, and the hidden content was restored.

This is a compact example of a modern control-plane incident.

First, the immediate failure was not a runner fleet capacity problem. It was not that Actions workers disappeared. It was that a service identity on a hot path was no longer allowed to do its job. When that identity failed, workflow runs could not authenticate and download actions.

Second, mitigation required more than reversing the bad decision. The account was restored quickly, but GitHub still had to deal with cached account state in a related service. That is a recurring incident pattern: the source of truth is fixed, but derived state keeps serving the old answer.

Third, the long-term prevention is not "tell people to be careful." GitHub said it added an allowlist of service accounts that cannot be suspended by automated systems and is improving diagnostic tooling for accounts while reducing cache propagation delays.

If you run an internal platform, this should send you straight to three questions.

One: which service identities are critical enough that automated enforcement should not be able to disable them without a second mechanism?

That does not mean service accounts should be above policy. It means the policy path needs production-grade controls. For human accounts, an automated suspension may be a reasonable default. For a service identity that gates every production deploy, every CI run, or every incident rollback, the system should probably require explicit break-glass approval, a staged disablement, or an automatic dependency impact check before enforcement takes effect.

Two: where is identity state cached, and what is the maximum time to flush it?

Authorization caches are usually introduced for good reasons: performance, scale, and fault tolerance. But in an incident, they become a second timeline. Your incident commander needs to know whether restoring an account fixes the system in seconds, minutes, or after a redeploy. If the only way to flush bad authorization state is to restart or redeploy an unrelated service, document that as an operational dependency.

Three: can your diagnostic tooling answer "why is this account disabled?" quickly?

Identity-plane incidents are painful because symptoms surface far away from the cause. A developer sees a failed build. A deployment system sees an HTTP 401. A webhook consumer sees a missing token. The person debugging the problem needs a tool that can trace from symptom to service identity, from service identity to enforcement decision, and from enforcement decision to the automation or human action that made it.

The clean takeaway: service identities are production dependencies. Treat their lifecycle, policy exceptions, caches, and observability like you treat databases and load balancers.

### GitHub App installation token failures: caches are part of authentication

GitHub also had a May 23 incident involving app installation token authentication. The status update says that between 06:00 and 19:12 UTC, GitHub experienced intermittent errors authenticating GitHub App installation tokens. During that window, between 1 and 5 percent of token authentication requests failed, averaging 2.3 percent and peaking at about 5.4 percent around 14:00 UTC. Users may have seen failures in Git operations and API calls using app installation tokens.

The root cause was an issue in a caching proxy component. GitHub remediated by rolling that component back to a previous version and said it is improving monitoring for cache miss anomalies and reviewing testing protocol for third-party dependency upgrades.

This one is easy to underestimate because the error percentages were not huge. But for automation, even a low single-digit authentication failure rate can be nasty. CI systems, deployment bots, repository synchronization, code scanning, documentation publishing, and internal platform workflows often assume token exchange is boring. When token validation becomes intermittently unreliable, automation starts failing in ways that look unrelated.

The SRE lesson is that authentication should have service-level objectives of its own, and those SLOs should include the cache layers in front of or behind the identity provider.

Cache behavior can change during a dependency upgrade. Cache misses can become a leading signal. A proxy can fail open, fail closed, or fail inconsistently depending on the type of error and the code path. A retry can help, but only if the failure mode is genuinely transient and the retry budget does not overload the identity path.

For teams operating internal developer platforms, I would turn this into a concrete runbook exercise:

What happens if 3 percent of token validations fail for two hours?

Do workflows retry safely? Do they produce clear error messages? Does the incident show up on the platform team's alerts before users start filing tickets? Can you distinguish "token rejected because the user is not allowed" from "token validation infrastructure is unhealthy"? Do you have a feature flag or fallback for non-critical automation that can absorb temporary identity flakiness without blocking the highest-priority production changes?

Authentication is not a yes-or-no feature. It is a distributed system with latency, error rates, caches, rollbacks, and change management. Operate it accordingly.

### Cloudflare: analytics degradation, registry availability, and maintenance as failover practice

Cloudflare's public status page this week showed a mix of incidents and scheduled maintenance, which is useful because it illustrates two sides of reliability work: unplanned degradation and planned risk.

On May 27, Cloudflare reported that Cloudflare Analytics was degraded and that customers might experience elevated errors or increased latency while reading data through the Cloudflare API. The issue was identified, a fix was implemented, and the incident was resolved later that day. The same status history also listed a container registry unavailability item, marked resolved, where customers might have seen intermittent unavailability with the managed container registry.

These are not the kind of incidents that necessarily take down every customer-facing application. But they matter during operations because analytics, API reads, and registries are part of how teams understand and change production.

An analytics degradation can become an incident amplifier. If a customer-facing incident is happening at the same time, teams may lose one of the instruments they use to determine scope. Are errors global or regional? Is traffic falling because users are gone, because routing changed, or because the dashboard is late? When the observability plane is degraded, the incident commander needs an alternate evidence path.

A registry availability problem has a different shape. Registries sit in deployment and recovery paths. If a team needs to roll forward, rebuild, or reschedule workloads that pull images, intermittent registry failures can turn a small incident into a stuck mitigation.

The Cloudflare maintenance entries are also worth reading. Several datacenter maintenance events warned that traffic might be rerouted, that users in affected regions might see slightly increased latency, and that private or cloud network interconnect customers should expect traffic to fail over elsewhere while interfaces could become temporarily unavailable.

That language is operationally valuable. Planned maintenance is a chance to validate assumptions. If your architecture says traffic can fail over, maintenance windows are real-world tests of whether it does. If your private network interconnect is a critical dependency, you should know what "fail over elsewhere" means for latency, routing policy, alerting, and customer support.

The practical lesson is to treat vendor maintenance notices as change events in your own system.

If a major edge provider is doing maintenance in a location that matters to you, annotate your dashboards. Reduce deployment risk if your system is already under stress. Watch regional latency and error budgets. If you depend on private interconnect, make sure your network team knows which path will carry traffic during maintenance and whether monitoring is set up to recognize that as expected instead of mysterious.

Planned maintenance is not downtime, but it is still a reliability event.

### Skydio: degraded connectivity and honest separation of symptoms

Skydio's May 19 post-incident review covers degraded connectivity on May 6 and 7 for remote flight operations. The customer-facing symptom was poor video performance and high latency during flights for some customers using X10 drones from docks and controlling them through Remote Flight Deck.

The details are specific and useful. Skydio says affected flights had significantly lower throughput than usual, with throughput of about 0.5 Mbps on affected flights instead of the typical 3 to 5 Mbps. Monitoring showed a drop in average network utilization of roughly 33 percent, from about 3 Mbps to 2 Mbps, while some customers had a larger capacity drop and did not have enough network capacity to support flight. Skydio worked with affected customers, identified root cause, and performed maintenance that restored normal service during a window on May 7.

The most important part for reliability practice is how the writeup separates degraded remote-operation experience from safety-critical local functions. Skydio says critical flight safety functions such as airspace deconfliction and Pathfinder were not affected, and that obstacle avoidance runs on the drone itself.

That is good incident communication discipline. It does not minimize the user impact: poor video and high latency can absolutely prevent successful missions. But it also avoids implying that every function in the system failed.

For SREs, this is a reminder to map your system by control loops.

Some control loops are local and safety-critical. Some are remote and supervisory. Some are customer-visible but not safety-critical. Some are telemetry-only. During an incident, each loop can have a different state. Your public update and internal command channel should be able to say, "live video is degraded," "autonomous safety function is operating normally," "remote commands are delayed," and "telemetry ingestion is delayed" as separate facts.

That separation matters because mitigation differs by loop. If the remote control surface is impaired, you may need to stop new missions, change operator guidance, or fall back to local autonomy. If safety functions are impaired, you need a much more severe response. If telemetry is impaired, you may need alternate reporting channels.

The broader lesson: design incident taxonomies around user outcomes and control loops, not just components. Component status is useful to engineers. Outcome status is useful to operators and customers.

## Platform/Cloud Updates

### AWS Resilience Hub: resilience programs are becoming continuous

On May 28, AWS announced the next generation of AWS Resilience Hub. The update brings together a new application model, dependency discovery assessment, generative AI-powered failure mode analysis, modular resilience policies, and organization-wide reporting.

The SRE-relevant part is the model: define resilience goals, discover dependencies, assess failure modes, test, and report across an application portfolio. That is where many organizations struggle. They may have one team with mature game days and error budgets, another team with a diagram in a wiki, and a third team whose only reliability artifact is an alert channel. The hard work is making resilience expectations explicit and repeatable without turning them into theater.

The update is also notable because it names SREs and development teams together. That is the right ownership shape. Resilience cannot live entirely in a central review board. It has to be close enough to application teams that failure modes are understood, but standardized enough that leadership can ask, "Which services meet policy, which do not, and what risk are we accepting?"

The risk with AI-assisted failure mode analysis is obvious: generated analysis can sound complete while missing the thing that actually fails. So use it as a prompt, not as proof. A useful workflow is: let the tool propose failure modes, require service owners to accept, reject, or edit them, connect those failure modes to concrete tests, and store the result as living operational evidence.

The better question is not "did the tool find every failure?" The better question is "did this process produce a testable resilience claim?"

### Honeycomb and AWS Fault Injection Service: resilience testing moves left and right

AWS also published a Cloud Operations post about how Honeycomb improved resilience using AWS Fault Injection Service. The important idea is the shift from reactive incident response toward proactive resilience testing, including game day simulations and fault injection experiments for pre-production and production workloads.

Fault injection is often discussed in extreme terms, as if every team must immediately start breaking production. That framing is not helpful. A mature path is incremental.

Start with low-risk experiments in a staging environment that actually resembles production in dependency shape. Then test one failure mode in production with tight guardrails: small scope, known rollback, clear abort conditions, and a person watching user-facing indicators. Over time, move from manual experiments to scheduled tests for known assumptions.

The SRE value of fault injection is not chaos for its own sake. It is assumption discovery.

You thought a retry policy would hide a transient dependency failure. It amplified traffic instead. You thought multi-AZ deployment meant capacity was available during failover. It was not, because all the warm capacity was in one cell. You thought alerts would fire on customer impact. They fired on CPU first and hid the useful signal.

Good resilience testing turns those surprises into planned work before an outage does.

## Kubernetes and Platform Engineering

Kubernetes 1.36 has a lot of reliability material, and the most useful way to read it is by operational theme.

First: better saturation signals. Pressure Stall Information metrics graduated to GA. PSI is important because utilization alone can lie. A node can show CPU below 100 percent while tasks are stalled and user-visible latency is rising. PSI reports time lost to contention for CPU, memory, and I/O at node, pod, and container levels. For SRE teams, this is a path to better alerts around "work is waiting" rather than only "resources are consumed."

Second: safer control-plane upgrades. Mixed Version Proxy moved to beta and is enabled by default in 1.36. The problem it addresses is subtle but serious: during a highly available control-plane upgrade, different API server instances may know about different resource versions. Without correct routing, a request for a resource unknown to an older API server can receive an incorrect 404. Mixed Version Proxy helps route those requests to a newer peer that understands the resource. For operators, this reduces upgrade weirdness where clients see false absence rather than temporary version skew.

Third: better recovery primitives for stateful workloads. Volume group snapshots reached GA. They provide crash-consistent snapshots across a set of persistent volume claims through CSI drivers. This matters for applications whose state spans multiple volumes. A single-volume snapshot can be technically successful and operationally useless if the application needs a consistent set.

Fourth: least privilege for node access. Fine-grained kubelet API authorization is GA. The motivation is replacing overly broad `nodes/proxy` access for common monitoring and observability use cases. That is both a security and reliability improvement. Over-broad privileges make incidents worse when credentials leak or automation behaves unexpectedly.

Fifth: workload-aware scheduling is evolving for AI, batch, and other coordinated workloads. Kubernetes 1.36 introduces updated Workload and PodGroup APIs in `scheduling.k8s.io/v1alpha2`, separating static workload templates from runtime PodGroup state. It also advances topology-aware scheduling and workload-aware preemption. The reliability point is that large distributed jobs often need all-or-nothing placement, topology awareness, and predictable preemption behavior. Scheduling one pod at a time is not enough for many modern workloads.

There are also alpha features that platform teams should watch but not blindly enable everywhere. Server-side sharded list and watch aims to reduce waste for high-cardinality controllers by letting each controller replica receive only the slice of resource events it owns. Pod-level resource managers offer a more flexible model for performance-sensitive pods with sidecars. Manifest-based admission control explores policies loaded from disk at API server startup, before normal API objects can be created or deleted.

The practical guidance is simple: do not treat Kubernetes release notes as a feature buffet. Build a reliability watchlist. Ask which features reduce known operational risk in your clusters, which features require provider support, which ones change upgrade behavior, and which ones need new dashboards or runbooks.

## Observability and Tooling

OpenTelemetry's graduation within CNCF is the headline for observability this month. CNCF announced the graduation on May 21 and pointed to very large package download numbers for JavaScript and Python API packages. The OpenTelemetry project also published blueprints and reference implementations this month, aimed at giving users more concrete deployment patterns.

Graduation matters because it signals maturity in governance, adoption, and project health. But the reliability impact is not automatic. Standards reduce one kind of uncertainty and expose another.

Before OpenTelemetry, many teams were stuck asking, "Which agent, which SDK, which vendor format, which propagation model?" After OpenTelemetry, more teams can agree on instrumentation and transport. That is good. But then the hard operating questions become unavoidable.

Who owns the collector fleet? Who reviews semantic convention changes? What gets sampled at the edge versus downstream? How do we prevent a noisy new service from doubling telemetry cost? What happens when the collector is down? Do application teams know whether telemetry export is blocking or non-blocking? Can we correlate traces with metrics and logs when queueing, pool exhaustion, or third-party latency is the real bottleneck?

This is why the CNCF blog discussion about teams still running multiple observability stacks is relevant. Many teams are satisfied enough with what they have but still open to switching because integration quality, cost, and complexity remain painful. OpenTelemetry is the common substrate, not the full operating model.

For SREs, I would frame the next phase as telemetry reliability engineering.

Telemetry pipelines need SLOs. Collectors need capacity planning. Sampling decisions need incident review. Instrumentation libraries need upgrade policy. Dashboards need ownership. Alerts need a retirement path. Logs need retention and privacy rules. And, crucially, teams need to know what signal remains available when a vendor API, analytics backend, or collector tier is degraded.

The Cloudflare analytics incident from this week is a useful reminder: observability systems are also production systems. If they fail, you need a fallback evidence plan.

## Practical Takeaways

First: audit critical service accounts.

List the service identities that gate deploys, CI, incident response, production access, billing, DNS, certificates, and monitoring. For each one, ask whether automated systems can disable it, what approval is required, what alert fires if it changes state, and how cached state is flushed.

Second: write an identity-plane incident runbook.

Most teams have database and compute runbooks. Fewer have a runbook for "tokens intermittently fail" or "service account disabled" or "authorization cache is stale." Build one. Include diagnostics, cache invalidation, rollback of recent proxy or dependency upgrades, and a clear escalation path to the identity owner.

Third: treat vendor maintenance as your own reliability signal.

If an edge, cloud, registry, DNS, or interconnect provider posts maintenance that can reroute traffic, annotate dashboards and check whether your alerting understands the expected shape. Planned failover is still failover.

Fourth: define alternate evidence paths.

If analytics or observability APIs are degraded during an incident, what else can you use? Load balancer logs, synthetic checks, client-side metrics, CDN status, direct database counters, support ticket volume, or external probes may provide enough signal to make decisions. Decide before the dashboard is gray.

Fifth: upgrade Kubernetes with intent.

For 1.36, look closely at PSI metrics, Mixed Version Proxy, kubelet authorization, and volume group snapshots. These are not just features. They are chances to improve saturation detection, upgrade safety, least privilege, and recovery.

Sixth: make fault injection boring.

Pick one high-value assumption and test it with guardrails. The best first experiment is usually small, reversible, and tied to a real runbook. The point is not drama. The point is evidence.

Seventh: operate OpenTelemetry as infrastructure.

Standard instrumentation is the beginning. Collector ownership, sampling, cost control, schema discipline, and telemetry failure modes are now part of the SRE job.

## Watchlist for next week

Watch for any deeper GitHub incident reports or follow-up detail around the May 26 Actions and Pages incident, especially anything about automated account review safeguards and authorization cache propagation.

Watch Cloudflare's status history for recurrence around analytics, container registry availability, and regional maintenance patterns. The important signal is not one isolated item; it is whether the same operational surface keeps appearing.

Watch AWS Resilience Hub adoption guidance and examples. The interesting question is whether teams can turn AI-assisted failure mode analysis into tested, reviewable resilience evidence.

Watch Kubernetes 1.36 provider rollout timing. Managed Kubernetes users should track when their providers expose PSI metrics, Mixed Version Proxy behavior, volume group snapshot support, and kubelet authorization changes.

Watch the OpenTelemetry ecosystem after graduation. The most useful next artifacts will not be announcements; they will be reference architectures, migration stories, collector scaling guidance, and examples of teams reducing telemetry cost without losing incident signal.

Finally, watch for public postmortems that discuss automation guardrails. The industry is going to keep seeing incidents where policy engines, account systems, caches, and AI-assisted operations touch production. The teams that do well will be the ones that add friction in the right places and observability to the decisions that used to be invisible.

## Closing

That is the Weekly SRE Briefing for May 30, 2026.

The thread through all of these stories is that reliability is no longer only about keeping compute, storage, and networks alive. It is about keeping the decision systems around them correct: account review, authentication caches, routing policy, scheduler placement, telemetry pipelines, maintenance failover, and resilience assessment.

For the coming week, pick one decision system in your environment and make it more observable. Not the service it protects, but the system that decides whether the service can deploy, authenticate, route, scale, or recover. Find the cache. Find the policy. Find the override. Find the runbook. Then test one assumption.

Small work there can prevent very large incidents later.

Thanks for listening.

## Sources

- GitHub Status: May 26, 2026 incident with Actions and Pages; automated account review suspension of GitHub Actions service account: https://www.githubstatus.com/
- GitHub Status: May 23, 2026 intermittent errors with app installation token authentication: https://www.githubstatus.com/
- Cloudflare Status: May 27, 2026 Cloudflare Analytics availability degraded; container registry unavailability; regional maintenance notices: https://www.cloudflarestatus.com/
- Skydio: Post-Incident Review for Degraded Connectivity on May 6-7, 2026: https://www.skydio.com/blog/post-incident-review-for-degraded-connectivity-may-2026
- AWS News Blog: Introducing the next generation of AWS Resilience Hub for generative AI-based SRE resilience journey: https://aws.amazon.com/blogs/aws/introducing-the-next-generation-of-aws-resilience-hub-for-generative-ai-based-sre-resilience-journey/
- AWS Cloud Operations Blog: How Honeycomb improved resilience using AWS Fault Injection Service: https://aws.amazon.com/blogs/mt/how-honeycomb-improved-resilience-using-aws-fault-injection-service/
- Kubernetes Blog: Kubernetes v1.36 PSI Metrics for Kubernetes Graduates to GA: https://kubernetes.io/blog/2026/05/12/kubernetes-v1-36-psi-metrics-ga/
- Kubernetes Blog: Kubernetes v1.36 Mixed Version Proxy Graduates to Beta: https://kubernetes.io/blog/2026/05/15/kubernetes-1-36-feature-mixed-version-proxy-beta/
- Kubernetes Blog: Kubernetes v1.36 Moving Volume Group Snapshots to GA: https://kubernetes.io/blog/2026/05/08/kubernetes-v1-36-volume-group-snapshot-ga/
- Kubernetes Blog: Kubernetes v1.36 Fine-Grained Kubelet API Authorization Graduates to GA: https://kubernetes.io/blog/2026/04/24/kubernetes-v1-36-fine-grained-kubelet-authorization-ga/
- Kubernetes Blog: Kubernetes v1.36 Advancing Workload-Aware Scheduling: https://kubernetes.io/blog/2026/05/13/kubernetes-v1-36-advancing-workload-aware-scheduling/
- Kubernetes Blog: Kubernetes v1.36 Server-Side Sharded List and Watch: https://kubernetes.io/blog/2026/05/06/kubernetes-v1-36-server-side-sharded-list-and-watch/
- CNCF Announcement: OpenTelemetry graduation: https://www.cncf.io/announcements/2026/05/21/cloud-native-computing-foundation-announces-opentelemetrys-graduation-solidifying-status-as-the-de-facto-observability-standard/
- OpenTelemetry Blog: Introducing OTel Blueprints and Reference Implementations: https://opentelemetry.io/blog/2026/blueprints-intro/
- CNCF Blog: The tools are ready. So why are most cloud native teams still running three observability stacks?: https://www.cncf.io/blog/2026/05/06/the-tools-are-ready-so-why-are-most-cloud-native-teams-still-running-three-observability-stacks/
