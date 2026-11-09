import { Card } from "./ui";

export function ComingSoon({
  title,
  icon,
  stage,
  features,
}: {
  title: string;
  icon: string;
  stage: string;
  features: string[];
}) {
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl">
        <span aria-hidden>{icon}</span> {title}
      </h1>
      <Card className="space-y-3">
        <p className="font-display text-primary-deep">{stage}에 열려요!</p>
        <ul className="space-y-2">
          {features.map((f) => (
            <li key={f} className="flex gap-2 text-ink-soft">
              <span aria-hidden>🔒</span>
              {f}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
