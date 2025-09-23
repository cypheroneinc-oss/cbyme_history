import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { CategoryKey, VectorKey } from '../../src/types/diagnostic.js';
import { scoringConfig } from '../../src/config/scoring.js';
import { ShareActions } from './share-actions';

type SearchParams = {
  typeId?: string | string[];
};

type PageProps = {
  searchParams?: SearchParams;
};

type TypeId = `${CategoryKey}-${VectorKey}`;

const categoryMap = new Map<CategoryKey, string>(
  scoringConfig.categories.map((category) => [category.key, category.label]),
);
const vectorMap = new Map<VectorKey, string>(scoringConfig.vectors.map((vector) => [vector.key, vector.label]));
const typeIds = scoringConfig.categories.flatMap((category) =>
  scoringConfig.vectors.map((vector) => `${category.key}-${vector.key}` as TypeId),
);
const validTypeIds = new Set<TypeId>(typeIds);

function resolveTypeId(searchParams?: SearchParams): TypeId | null {
  if (!searchParams) {
    return null;
  }
  const candidate = searchParams.typeId;
  if (!candidate) {
    return null;
  }
  const singleValue = Array.isArray(candidate) ? candidate[0] : candidate;
  if (!singleValue || !validTypeIds.has(singleValue as TypeId)) {
    return null;
  }
  return singleValue as TypeId;
}

function describeType(typeId: TypeId): string {
  const [categoryKey, vectorKey] = typeId.split('-') as [CategoryKey, VectorKey];
  const categoryLabel = categoryMap.get(categoryKey) ?? categoryKey;
  const vectorLabel = vectorMap.get(vectorKey) ?? vectorKey;
  return `${categoryLabel} × ${vectorLabel}`;
}

function buildCardPath(typeId: TypeId): string {
  return `/cards/${typeId}.png`;
}

const defaultMetadata: Metadata = {
  title: '診断結果',
  description: '診断結果のカードを確認できます。',
};

export function generateMetadata({ searchParams }: PageProps): Metadata {
  const resolvedTypeId = resolveTypeId(searchParams);
  if (!resolvedTypeId) {
    return defaultMetadata;
  }

  const typeLabel = describeType(resolvedTypeId);
  const cardPath = buildCardPath(resolvedTypeId);

  return {
    title: `診断結果: ${typeLabel}`,
    description: `${typeLabel} の診断結果カードを表示しています。`,
    openGraph: {
      title: `診断結果: ${typeLabel}`,
      description: `${typeLabel} の診断結果カードを表示しています。`,
      images: [{ url: cardPath, alt: `${typeLabel} の診断カード` }],
    },
  } satisfies Metadata;
}

export default function ResultPage({ searchParams }: PageProps) {
  const typeId = resolveTypeId(searchParams) ?? notFound();

  const typeLabel = describeType(typeId);
  const cardPath = buildCardPath(typeId);

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '32px 16px 64px',
        gap: '24px',
      }}
    >
      <header style={{ textAlign: 'center', maxWidth: '600px' }}>
        <p style={{ margin: '0 0 8px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#2563eb' }}>
          RESULT
        </p>
        <h1 style={{ margin: '0 0 12px', fontSize: '28px', lineHeight: 1.2 }}>診断結果</h1>
        <p style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>{typeLabel}</p>
      </header>
      <div
        style={{
          width: 'min(100%, 480px)',
          borderRadius: '24px',
          overflow: 'hidden',
          boxShadow: '0 24px 48px rgba(15, 23, 42, 0.15)',
          backgroundColor: '#ffffff',
        }}
      >
        <Image
          src={cardPath}
          alt={`${typeLabel} の診断カード`}
          width={960}
          height={1358}
          style={{ width: '100%', height: 'auto', display: 'block' }}
          priority
        />
      </div>
      <ShareActions typeId={typeId} typeLabel={typeLabel} />
      <p style={{ margin: '12px 0 0', color: '#4b5563' }}>
        別の結果を知りたいときは{' '}
        <Link href="/" style={{ color: '#2563eb', fontWeight: 600 }}>
          診断に戻る
        </Link>
        {' '}から回答を送信してください。
      </p>
    </main>
  );
}
