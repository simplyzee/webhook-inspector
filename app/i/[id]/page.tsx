import { Inspector } from "./inspector";

export default async function InspectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Inspector id={id} />;
}
