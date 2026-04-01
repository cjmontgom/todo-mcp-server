import { MCP_COPY } from "../copy/mcpExplainer";

export function SamplingPanel() {
  return (
    <section className="panel">
      <h2>Sampling</h2>
      <p className="blurb">{MCP_COPY.samplingBlurb}</p>
      <div className="sampling-copy">
        <p>{MCP_COPY.samplingConcept}</p>

        <ol className="sampling-flow">
          {MCP_COPY.samplingFlow.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>

        <p className="sampling-architecture-note">
          {MCP_COPY.samplingArchitectureNote}
        </p>
      </div>
    </section>
  );
}
