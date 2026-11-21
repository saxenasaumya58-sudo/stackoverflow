import QuestionDetailClient from "@/components/question-detail-client";

export default function QuestionDetailPage({ params }) {
  return <QuestionDetailClient questionId={params.id} />;
}
